import { useState } from 'react';
import { CardData, CardType, Workspace, FileSystemNode, Connector } from '../types';
import { soundService } from '../services/soundService';
import { DEFAULT_WHITEBOARD_DATA, TAB_COLORS } from '../data/whiteboardTemplates';
import { reconcileCards } from '../services/gridPlanner';

interface UseWorkspacesArgs {
  activeNodeId: string;
  setNodes: React.Dispatch<React.SetStateAction<Record<string, FileSystemNode>>>;
  pan: { x: number; y: number };
  scale: number;
  history: {
    pushHistory: (snapshot: CardData[]) => void;
    undo: (currentCards: CardData[]) => CardData[] | null;
    redo: (currentCards: CardData[]) => CardData[] | null;
  };
}

/**
 * Owns whiteboard workspaces (tabs) and the active workspace, plus all card
 * mutations. Card writes are mirrored into the owning node's `whiteboardData`
 * via setNodes. Undo/redo delegate snapshot bookkeeping to the history hook.
 */
export function useWorkspaces({ activeNodeId, setNodes, pan, scale, history }: UseWorkspacesArgs) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    () => JSON.parse(JSON.stringify(DEFAULT_WHITEBOARD_DATA))
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('tab-1');

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Writes cards into the active workspace AND mirrors into the node tree.
  // Does NOT touch history — callers decide whether to record a snapshot.
  const writeCards = (newCards: CardData[]) => {
    // Reconcile derived cross-card fields (e.g. linked Feed-Planner dates) centrally,
    // so every view (Calendar/Unscheduled) stays in sync regardless of render timing.
    const reconciled = reconcileCards(newCards);
    const idSet = new Set(reconciled.map(c => c.id));
    const updated = workspaces.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const next: Workspace = { ...w, cards: reconciled };
      // Prune connectors whose endpoints no longer exist (e.g. a card was deleted).
      if (w.connectors && w.connectors.length) {
        next.connectors = w.connectors.filter(c => idSet.has(c.from) && idSet.has(c.to));
      }
      return next;
    });
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const connectors: Connector[] = activeWorkspace?.connectors || [];

  // Connector edits mirror to the node tree (no card-history snapshot in v1).
  const updateConnectors = (next: Connector[]) => {
    const updated = workspaces.map(w => w.id === activeWorkspaceId ? { ...w, connectors: next } : w);
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const updateCards = (newCards: CardData[]) => {
    history.pushHistory(activeWorkspace.cards);
    writeCards(newCards);
  };

  // Persist a card change WITHOUT recording undo history (e.g. z-index bump on
  // select, auto-resize). Still mirrors to nodes so it saves on the next debounce.
  const updateCardsSilent = (newCards: CardData[]) => {
    writeCards(newCards);
  };

  const handleUndo = () => {
    const previous = history.undo(activeWorkspace.cards);
    if (previous) writeCards(previous);
  };

  const handleRedo = () => {
    const next = history.redo(activeWorkspace.cards);
    if (next) writeCards(next);
  };

  const addCard = (type: CardType, props: any = {}) => {
    soundService.play('drop');
    // Calculate center of current view
    const centerX = (window.innerWidth / 2 - pan.x) / scale - 150;
    const centerY = (window.innerHeight / 2 - pan.y) / scale - 100;

    const newCard: CardData = {
      id: `card-${Date.now()}`,
      type,
      x: centerX,
      y: centerY,
      width: 340,
      height: 400,
      zIndex: 10,
      content: props,
      ...props // Spread geometry overrides if any
    };
    updateCards([...activeWorkspace.cards, newCard]);
    return newCard.id;
  };

  const addTab = () => {
    soundService.play('drop');
    const newWs: Workspace = {
      id: `tab-${Date.now()}`,
      name: `Sheet ${workspaces.length + 1}`,
      cards: [],
      color: TAB_COLORS[workspaces.length % TAB_COLORS.length]
    };
    const updated = [...workspaces, newWs];
    setWorkspaces(updated);
    setActiveWorkspaceId(newWs.id);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const updateTabName = (id: string, name: string) => {
    const updated = workspaces.map(w => w.id === id ? { ...w, name } : w);
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const updateTabColor = (id: string, color: string) => {
    const updated = workspaces.map(w => w.id === id ? { ...w, color } : w);
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const deleteTab = (id: string) => {
    if (workspaces.length <= 1) return;
    const updated = workspaces.filter(w => w.id !== id);
    setWorkspaces(updated);
    setActiveWorkspaceId(updated[0].id);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  // Move a tab from one index to another (drag-to-reorder). Persists the new
  // array order; harmless to the blob (order IS the array order).
  const reorderTabs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const updated = [...workspaces];
    const [moved] = updated.splice(fromIndex, 1);
    if (!moved) return;
    updated.splice(toIndex, 0, moved);
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  // Duplicate a tab with fresh card ids (remapped so nothing collides) + its
  // connectors, inserted right after the source; becomes the active tab.
  const duplicateTab = (id: string) => {
    const src = workspaces.find(w => w.id === id);
    if (!src) return;
    soundService.play('drop');
    const idMap = new Map<string, string>();
    (src.cards || []).forEach(c => idMap.set(c.id, `card-${Date.now()}-${Math.round(Math.random() * 1e6)}`));
    const cards = (src.cards || []).map(c => {
      const cloned: CardData = JSON.parse(JSON.stringify(c));
      cloned.id = idMap.get(c.id)!;
      if (cloned.type === CardType.ZONE) {
        const zc = cloned.content as any;
        zc.childIds = (zc.childIds || []).map((cid: string) => idMap.get(cid)).filter(Boolean);
      }
      return cloned;
    });
    const connectorsCloned = (src.connectors || [])
      .map(cn => ({ ...cn, id: `conn-${Date.now()}-${Math.round(Math.random() * 1e6)}`, from: idMap.get(cn.from)!, to: idMap.get(cn.to)! }))
      .filter(cn => cn.from && cn.to);
    const newWs: Workspace = {
      id: `tab-${Date.now()}`,
      name: `${src.name} copy`,
      cards,
      color: src.color,
      connectors: connectorsCloned,
    };
    const idx = workspaces.findIndex(w => w.id === id);
    const updated = [...workspaces];
    updated.splice(idx + 1, 0, newWs);
    setWorkspaces(updated);
    setActiveWorkspaceId(newWs.id);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  // Update a card's comments — the card may live on a NON-active sheet (the chat
  // drawer aggregates all sheets), so this writes into the given workspace
  // directly. Silent (no undo entry), same mirroring pattern as tab ops.
  const updateCardComments = (workspaceId: string, cardId: string, comments: unknown[]) => {
    const updated = workspaces.map(w => w.id !== workspaceId ? w : {
      ...w,
      cards: w.cards.map(c => c.id === cardId ? { ...c, content: { ...(c.content as any), comments } } : c)
    });
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  const toggleTabLock = (id: string) => {
    const updated = workspaces.map(w => w.id === id ? { ...w, isLocked: !w.isLocked } : w);
    setWorkspaces(updated);
    setNodes(prev => ({ ...prev, [activeNodeId]: { ...prev[activeNodeId], whiteboardData: updated } }));
  };

  return {
    workspaces,
    setWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    updateCards,
    updateCardsSilent,
    handleUndo,
    handleRedo,
    addCard,
    addTab,
    updateTabName,
    updateTabColor,
    deleteTab,
    reorderTabs,
    duplicateTab,
    toggleTabLock,
    updateCardComments,
    connectors,
    updateConnectors,
  };
}
