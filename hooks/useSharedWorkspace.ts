import { useState, useEffect, useRef, useCallback } from 'react';
import { FileSystemNode, CalendarEvent, BrandRole } from '../types';
import { canEdit } from '../services/brandMembers';
import { soundService } from '../services/soundService';
import {
  SharedBrandRef, SharedBrandData, loadBrandDataResult, saveBrandData, subscribeBrand,
} from '../services/teamsBackend';

/**
 * The shared-brand store (Teams Phase 2, Round 2). A brand shared with others is a
 * SHARED DOCUMENT: its data lives in `brand_data` and is the live source of truth
 * for everyone who opens it — owner included. This hook is the parallel of
 * useFileSystem + useCalendarEvents, but backed by that one DB row instead of the
 * per-user `sosa_data` blob. So a member's OWN file_system is never touched.
 *
 * Safety shape mirrors useFileSystem: discriminated load (never treat an error as
 * "empty"), gated + debounced save, localStorage cache, flush-on-close, never save
 * `{}`. Writes are gated by ROLE — viewer/commenter get readOnly=true and their
 * setNodes/event ops are no-ops, so read-only members can't persist anything.
 * Realtime keeps everyone live; concurrency is last-write-wins (the server-side
 * brand_data_history trigger is the recovery net).
 */

const cacheKeyFor = (sid: string) => `sosa_shared_${sid}`;
const readCache = (sid: string): SharedBrandData | null => {
  try { const raw = localStorage.getItem(cacheKeyFor(sid)); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writeCache = (sid: string, data: SharedBrandData) => {
  try { localStorage.setItem(cacheKeyFor(sid), JSON.stringify(data)); } catch { /* quota */ }
};

const EMPTY: SharedBrandData = { nodes: {}, events: [], brand: {} };

export interface SharedWorkspace {
  ready: boolean;
  readOnly: boolean;
  role: BrandRole;
  nodes: Record<string, FileSystemNode>;
  setNodes: React.Dispatch<React.SetStateAction<Record<string, FileSystemNode>>>;
  events: CalendarEvent[];
  brand: any;
  // Tree CRUD (same signatures as useFileSystem, bound to the shared store).
  handleUpdateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  handleMoveNode: (dragId: string, targetId: string) => void;
  handleReorderNode: (dragId: string, targetId: string) => void;
  toggleFavorite: (id: string) => void;
  toggleExpand: (id: string) => void;
  getSortedChildren: (filterFn: (n: FileSystemNode) => boolean) => FileSystemNode[];
  createNode: (node: FileSystemNode) => void;
  deleteNode: (id: string) => void;
  // Calendar (same signatures as useCalendarEvents).
  addEvent: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => string;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
}

// When no shared brand is open, App still calls this hook (rules of hooks) with a
// null ref; it stays inert (ready=false) and its writers are no-ops.
export function useSharedWorkspace(shared: SharedBrandRef | null): SharedWorkspace {
  const role: BrandRole = shared?.role ?? 'viewer';
  const readOnly = !shared || !canEdit(role);
  const sid = shared?.sharedBrandId ?? null;

  const [nodes, setNodesState] = useState<Record<string, FileSystemNode>>({});
  const [events, setEventsState] = useState<CalendarEvent[]>([]);
  const [brand, setBrand] = useState<any>({});
  const [ready, setReady] = useState(false);

  const loadedSidRef = useRef<string | null>(null);
  const lastSavedRef = useRef<string>('');
  const latestRef = useRef<SharedBrandData>(EMPTY);
  latestRef.current = { nodes, events, brand };

  const applyLoaded = useCallback((sidLocal: string, d: SharedBrandData) => {
    setNodesState(d.nodes || {});
    setEventsState(d.events || []);
    setBrand(d.brand || {});
    setReady(true);
    lastSavedRef.current = JSON.stringify({ nodes: d.nodes || {}, events: d.events || [], brand: d.brand || {} });
    loadedSidRef.current = sidLocal;
    writeCache(sidLocal, { nodes: d.nodes || {}, events: d.events || [], brand: d.brand || {} });
  }, []);

  // Reset when the open shared brand changes / closes.
  useEffect(() => {
    if (!sid) { loadedSidRef.current = null; setReady(false); setNodesState({}); setEventsState([]); setBrand({}); }
  }, [sid]);

  // Load once per shared brand (discriminated; retry on error, never clobber).
  useEffect(() => {
    if (!sid) return;
    if (loadedSidRef.current === sid) return;
    let cancelled = false;
    const cached = readCache(sid);
    if (cached) { setNodesState(cached.nodes || {}); setEventsState(cached.events || []); setBrand(cached.brand || {}); setReady(true); }

    const attempt = async (tries: number) => {
      if (cancelled) return;
      const res = await loadBrandDataResult(sid);
      if (cancelled) return;
      if (res.status === 'ok') { applyLoaded(sid, res.data); return; }
      if (res.status === 'empty') { applyLoaded(sid, cached || EMPTY); return; }
      if (tries < 4) { setTimeout(() => attempt(tries + 1), 500 * 2 ** tries); return; }
      if (cached) applyLoaded(sid, cached);
      else { loadedSidRef.current = sid; setReady(true); } // give up loading, but do NOT save over possibly-real data
    };
    attempt(0);
    return () => { cancelled = true; };
  }, [sid, applyLoaded]);

  // Debounced save (editors/owner only; gated on a completed load; never save empty).
  useEffect(() => {
    if (!sid || readOnly) return;
    if (loadedSidRef.current !== sid) return;
    const serialized = JSON.stringify({ nodes, events, brand });
    if (serialized === lastSavedRef.current) return;
    if (!nodes || Object.keys(nodes).length === 0) return; // never wipe the shared store
    const timer = setTimeout(async () => {
      writeCache(sid, { nodes, events, brand });
      const ok = await saveBrandData(sid, { nodes, events, brand });
      if (ok) lastSavedRef.current = serialized;
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, events, brand, sid, readOnly]);

  // Live: apply remote changes (from the owner or other editors). Ignore our own
  // echoes (serialized === lastSaved). Members read-only still see live updates.
  useEffect(() => {
    if (!sid) return;
    const onData = async () => {
      const res = await loadBrandDataResult(sid);
      if (res.status !== 'ok') return;
      const serialized = JSON.stringify({ nodes: res.data.nodes || {}, events: res.data.events || [], brand: res.data.brand || {} });
      if (serialized === lastSavedRef.current) return; // our own write echoing back
      applyLoaded(sid, res.data);
    };
    const unsub = subscribeBrand(sid, { onData });
    return () => unsub();
  }, [sid, applyLoaded]);

  // Flush on tab hide/close.
  useEffect(() => {
    if (!sid || readOnly) return;
    const flush = () => {
      if (loadedSidRef.current !== sid) return;
      const d = latestRef.current;
      const serialized = JSON.stringify(d);
      if (serialized === lastSavedRef.current) return;
      if (!d.nodes || Object.keys(d.nodes).length === 0) return;
      writeCache(sid, d);
      saveBrandData(sid, d);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [sid, readOnly]);

  // A read-only member's setNodes is inert — nothing they do can persist.
  const setNodes = useCallback<React.Dispatch<React.SetStateAction<Record<string, FileSystemNode>>>>(
    (update) => { if (readOnly) return; setNodesState(update); },
    [readOnly],
  );

  const handleUpdateNode = useCallback((id: string, updates: Partial<FileSystemNode>) => {
    if (readOnly) return;
    setNodesState(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, [readOnly]);

  const handleMoveNode = useCallback((dragId: string, targetId: string) => {
    if (readOnly || dragId === targetId) return;
    setNodesState(prev => {
      const target = prev[targetId];
      let newParentId: string | null = null;
      if (targetId === 'root') newParentId = null;
      else if (target && target.type === 'folder') newParentId = targetId;
      else if (target) newParentId = target.parentId;
      return { ...prev, [dragId]: { ...prev[dragId], parentId: newParentId } };
    });
  }, [readOnly]);

  const toggleFavorite = useCallback((id: string) => {
    if (readOnly) return;
    soundService.play('toggle');
    setNodesState(prev => ({ ...prev, [id]: { ...prev[id], isFavorite: !prev[id].isFavorite } }));
  }, [readOnly]);

  const toggleExpand = useCallback((id: string) => {
    // Expand/collapse is a local view nicety; allow it even for read-only members
    // (it doesn't persist for them because setNodes is inert — mirror it locally).
    setNodesState(prev => (prev[id] ? { ...prev, [id]: { ...prev[id], isExpanded: !prev[id].isExpanded } } : prev));
  }, []);

  const getSortedChildren = useCallback((filterFn: (n: FileSystemNode) => boolean) =>
    (Object.values(nodes) as FileSystemNode[])
      .filter(n => n && n.type && filterFn(n))
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
  [nodes]);

  const createNode = useCallback((node: FileSystemNode) => {
    if (readOnly) return;
    setNodesState(prev => ({ ...prev, [node.id]: node }));
  }, [readOnly]);

  const deleteNode = useCallback((id: string) => {
    if (readOnly) return;
    setNodesState(prev => {
      const next = { ...prev };
      // Remove the node and any descendants.
      const toRemove = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of Object.values(next) as FileSystemNode[]) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) { toRemove.add(n.id); grew = true; }
        }
      }
      toRemove.forEach(rid => delete next[rid]);
      return next;
    });
  }, [readOnly]);

  const addEvent = useCallback((data: Omit<CalendarEvent, 'id' | 'createdAt'>): string => {
    const id = `evt-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    if (readOnly) return id;
    setEventsState(prev => [...prev, { ...data, id, createdAt: new Date().toISOString() }]);
    return id;
  }, [readOnly]);

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    if (readOnly) return;
    setEventsState(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, [readOnly]);

  const deleteEvent = useCallback((id: string) => {
    if (readOnly) return;
    setEventsState(prev => prev.filter(e => e.id !== id));
  }, [readOnly]);

  return {
    ready, readOnly, role, nodes, setNodes, events, brand,
    handleUpdateNode, handleMoveNode, handleReorderNode: handleMoveNode,
    toggleFavorite, toggleExpand, getSortedChildren, createNode, deleteNode,
    addEvent, updateEvent, deleteEvent,
  };
}
