import { useState, useEffect, useRef } from 'react';
import { FileSystemNode } from '../types';
import { saveNodesToSupabase, loadNodesFromSupabase } from '../services/supabase';
import { soundService } from '../services/soundService';
import { stripBlobUrls } from '../services/fileService';
import { resolveLoadDecision, sanitizeNodes } from '../services/persistenceDecision';
import { recordSnapshot, listSnapshots, restoreSnapshot } from '../services/snapshotRing';

const cacheKeyFor = (uid: string) => `sosa_fs_${uid}`;
const readCache = (uid: string): Record<string, FileSystemNode> | null => {
  try {
    const raw = localStorage.getItem(cacheKeyFor(uid));
    if (!raw) return null;
    const parsed = sanitizeNodes(JSON.parse(raw));
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch { return null; }
};
const writeCache = (uid: string, nodes: Record<string, FileSystemNode>) => {
  try { localStorage.setItem(cacheKeyFor(uid), JSON.stringify(nodes)); } catch { /* quota / private mode */ }
};

const DEFAULT_FOLDERS: Record<string, FileSystemNode> = {
  'folder-campaigns': { id: 'folder-campaigns', type: 'folder', name: 'Campaigns', parentId: null, order: 0, description: 'Launch calendars and seasonal events' },
  'folder-channels': { id: 'folder-channels', type: 'folder', name: 'Channels', parentId: null, order: 1, description: 'Social, Email, and Blog content' },
  'folder-paid': { id: 'folder-paid', type: 'folder', name: 'Paid Media', parentId: null, order: 2, description: 'Ad creative and performance' },
  'folder-assets': { id: 'folder-assets', type: 'folder', name: 'Brand Assets', parentId: null, order: 3, description: 'Guidelines and core assets' },
  'folder-creative': { id: 'folder-creative', type: 'folder', name: 'Creative Library', parentId: null, order: 4, description: 'Work in progress' },
  'folder-reports': { id: 'folder-reports', type: 'folder', name: 'Insights & Reports', parentId: null, order: 5, description: 'Analytics and research' },
};

interface UseFileSystemArgs {
  session: any;
  onboardingComplete: boolean;
}

/**
 * Owns the file-system node tree (folders / pages / whiteboards), the active
 * node selection, and persistence (load on auth, debounced auto-save).
 * Node operations that require canvas navigation (navigate, delete-active,
 * whiteboard creation) stay in App as orchestration glue.
 */
export function useFileSystem({ session, onboardingComplete }: UseFileSystemArgs) {
  const [nodes, setNodes] = useState<Record<string, FileSystemNode>>({});
  const [activeNodeId, setActiveNodeId] = useState<string>('root');
  const [isSyncing, setIsSyncing] = useState(false);
  // True when the last attempted write to Supabase failed. Surfaced in the UI so
  // the user is never silently losing work; the retry watchdog keeps trying.
  const [saveError, setSaveError] = useState(false);
  // True once the initial load for the current user has settled — gates the UI so
  // we never render an empty home page during the async load (the "empty flash").
  const [nodesLoaded, setNodesLoaded] = useState(false);

  // Persistence safety refs:
  // - loadedUserIdRef: the user id we've COMPLETED a load for. Saving is blocked
  //   until this matches the current user, so we can never write before we read.
  // - lastSavedSerializedRef: serialized snapshot of the last known-persisted tree,
  //   to detect "dirty" precisely and skip redundant writes.
  // - latestNodesRef: latest tree, for flush-on-close.
  const loadedUserIdRef = useRef<string | null>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const latestNodesRef = useRef<Record<string, FileSystemNode>>({});
  latestNodesRef.current = nodes;

  const userId: string | undefined = session?.user?.id;

  // Reset the loaded gate when the user changes / signs out → next login reloads.
  useEffect(() => {
    if (!userId) { loadedUserIdRef.current = null; setNodesLoaded(false); }
  }, [userId]);

  // Load nodes once per user (keyed on stable user id, not the session object so
  // token refreshes don't re-trigger). CRITICAL: a load FAILURE must never be
  // treated as "first run" — that previously seeded DEFAULT_FOLDERS over real data.
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current === userId) return;

    let cancelled = false;

    // Pre-hydrate instantly from the local cache so a returning user sees their
    // content immediately instead of an empty flash; Supabase reconciles below.
    const cached = readCache(userId);
    if (cached) { setNodes(cached); setNodesLoaded(true); }

    // Apply a pure load decision (see services/persistenceDecision) — the branching
    // that must NEVER seed defaults over real data on a load error now lives there,
    // unit-tested; this just executes the resulting side effects.
    const applyDecision = (d: ReturnType<typeof resolveLoadDecision>) => {
      if (cancelled || !d) return;
      setNodes(d.nodesToSet);
      setNodesLoaded(true);
      latestNodesRef.current = d.nodesToSet;
      lastSavedSerializedRef.current = d.markSavedSerialized;
      if (d.enableSaving) loadedUserIdRef.current = userId; // enables saving for this user
      if (d.writeCacheToo) writeCache(userId, d.nodesToSet);
      setIsSyncing(false);
      if (d.saveToDb) saveNodesToSupabase(d.saveToDb);
    };

    const attempt = async (tries: number) => {
      if (cancelled) return;
      setIsSyncing(true);
      const res = await loadNodesFromSupabase();
      if (cancelled) return;
      const decision = resolveLoadDecision(res, readCache(userId), DEFAULT_FOLDERS, tries >= 4);
      // null decision = transient error, not yet exhausted → retry with backoff.
      if (!decision) { setTimeout(() => attempt(tries + 1), 500 * 2 ** tries); return; }
      applyDecision(decision);
    };

    attempt(0);
    return () => { cancelled = true; };
  }, [userId, onboardingComplete]);

  // Debounced auto-save. Gated on a completed load; never writes empty or unchanged
  // trees; mirrors to localStorage every time (offline-resilient safety net).
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current !== userId) return;        // never save before load
    if (Object.keys(nodes).length === 0) return;           // never persist empty
    // Strip transient blob: previews (optimistic uploads in flight) so we never
    // persist a dead reference; the real Storage URL persists once the upload swaps in.
    const cleanNodes = stripBlobUrls(nodes);
    const serialized = JSON.stringify(cleanNodes);
    if (serialized === lastSavedSerializedRef.current) return; // not dirty

    setIsSyncing(true);
    const timer = setTimeout(async () => {
      writeCache(userId, cleanNodes);                       // local cache first (sync, durable)
      const ok = await saveNodesToSupabase(cleanNodes);
      if (ok) {
        lastSavedSerializedRef.current = serialized;        // only trust DB on confirmed write
        recordSnapshot(userId, serialized);                 // data-history net (bounded, deduped)
        setSaveError(false);
      } else {
        // Failed write: DON'T advance lastSaved (so it stays dirty) and let the
        // watchdog below keep retrying — a failed save must never mean the newest
        // state is quietly dropped just because the user stopped editing.
        setSaveError(true);
      }
      setIsSyncing(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, userId, onboardingComplete]);

  // Retry watchdog: while the tree is dirty (last save failed / never landed),
  // keep retrying in the background even if the user makes no further edits.
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    const tick = setInterval(async () => {
      if (loadedUserIdRef.current !== userId) return;
      const tree = latestNodesRef.current;
      if (!tree || Object.keys(tree).length === 0) return;
      const cleanTree = stripBlobUrls(tree);
      const serialized = JSON.stringify(cleanTree);
      if (serialized === lastSavedSerializedRef.current) return; // already persisted
      const ok = await saveNodesToSupabase(cleanTree);
      if (ok) {
        lastSavedSerializedRef.current = serialized;
        recordSnapshot(userId, serialized);
        setSaveError(false);
      } else {
        setSaveError(true);
      }
    }, 15000);
    return () => clearInterval(tick);
  }, [userId, onboardingComplete]);

  // Flush pending changes when the tab is hidden/closed (covers "closed the browser
  // 1s after an edit"). localStorage write is synchronous and guaranteed; the
  // Supabase upsert is best-effort.
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      const tree = latestNodesRef.current;
      if (!tree || Object.keys(tree).length === 0) return;
      if (loadedUserIdRef.current !== userId) return;
      const cleanTree = stripBlobUrls(tree);
      const serialized = JSON.stringify(cleanTree);
      if (serialized === lastSavedSerializedRef.current) return;
      writeCache(userId, cleanTree);
      recordSnapshot(userId, serialized); // best-effort data-history on close
      saveNodesToSupabase(cleanTree);
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
  }, [userId]);

  const handleUpdateNode = (id: string, updates: Partial<FileSystemNode>) => {
    setNodes(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const handleMoveNode = (dragId: string, targetId: string) => {
    if (dragId === targetId) return;

    const targetNode = nodes[targetId];
    let newParentId: string | null = null;

    if (targetId === 'root') {
      newParentId = null;
    } else if (targetNode && targetNode.type === 'folder') {
      newParentId = targetId;
    } else if (targetNode) {
      // Dropped on a file? Move to that file's parent (sibling reorder intent usually)
      newParentId = targetNode.parentId;
    }

    setNodes(prev => ({
      ...prev,
      [dragId]: { ...prev[dragId], parentId: newParentId }
    }));
  };

  const handleReorderNode = (dragId: string, targetId: string) => {
    handleMoveNode(dragId, targetId);
  };

  const toggleFavorite = (id: string) => {
    soundService.play('toggle');
    setNodes(prev => ({ ...prev, [id]: { ...prev[id], isFavorite: !prev[id].isFavorite } }));
  };

  const toggleExpand = (id: string) => {
    setNodes(prev => ({ ...prev, [id]: { ...prev[id], isExpanded: !prev[id].isExpanded } }));
  };

  const getSortedChildren = (filterFn: (n: FileSystemNode) => boolean) => {
    return (Object.values(nodes) as FileSystemNode[])
      .filter(n => n && n.type && filterFn(n))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // --- Recovery: list / restore local snapshots (bounded ring per user) ---
  const getSnapshots = () => (userId ? listSnapshots(userId) : []);
  const restoreFromSnapshot = (ts: number): boolean => {
    if (!userId) return false;
    const tree = restoreSnapshot(userId, ts);
    if (!tree) return false;
    // Set through the normal path — the gated debounced save persists it and the
    // dirty-check writes it to the DB. Never bypasses the persistence invariants.
    setNodes(tree);
    return true;
  };

  return {
    nodes,
    setNodes,
    activeNodeId,
    setActiveNodeId,
    isSyncing,
    saveError,
    nodesLoaded,
    handleUpdateNode,
    handleMoveNode,
    handleReorderNode,
    toggleFavorite,
    toggleExpand,
    getSortedChildren,
    getSnapshots,
    restoreFromSnapshot,
  };
}
