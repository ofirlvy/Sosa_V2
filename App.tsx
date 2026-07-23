
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CardType, ToolType, FileSystemNode, NodeType, Position, BoardChatMessage, Comment } from './types';
import { BoardChatDrawer } from './components/BoardChatDrawer';
import { PublishKitModal } from './components/modals/PublishKitModal';
import { collectQueue, dueTargets, markTargetsNeedAction, setTargetStatus, notifyDue, QueueItem } from './services/publishReminders';
import { Canvas } from './components/Canvas';
import { DrawingToolbar } from './components/ui/DrawingToolbar';
import { Sidebar } from './components/Sidebar';
import { PageView } from './components/PageView';
import { CalendarView } from './components/CalendarView';
import { FeedPlannerView } from './components/FeedPlannerView';
import { TemplateModal } from './components/modals/TemplateModal';
import { useAuth } from './hooks/useAuth';
import { useFileSystem } from './hooks/useFileSystem';
import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useBrandSpaces } from './hooks/useBrandSpaces';
import { pendingUploadCount } from './services/fileService';
import { filterNodesByBrand, eventInBrand, nodeInBrand, DEFAULT_BRAND_ID, seedFoldersForBrand } from './services/brandSpaces';
import { reconcileCards } from './services/gridPlanner';
import { DEFAULT_RECENT_TOOLS } from './components/toolVisuals';
import { ShareModal } from './components/modals/ShareModal';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { useWorkspaces } from './hooks/useWorkspaces';
import { DEFAULT_WHITEBOARD_DATA, TAB_COLORS, buildTemplate } from './data/whiteboardTemplates';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { OnboardingFlow } from './components/auth/OnboardingFlow';
import { BrandIdentityProvider } from './contexts/BrandIdentity';
import { resolveRoster } from './services/brandMembers';
import { MembersModal } from './components/modals/MembersModal';
import { useOwnerMirror } from './hooks/useOwnerMirror';
import { useSharedRoster } from './hooks/useSharedRoster';
import { useMemberBrands } from './hooks/useMemberBrands';
import { SharedBrandView } from './components/SharedBrandView';
import { createEmailInvite, updateMemberRole, removeMember, revokeInvite } from './services/teamsBackend';
import {
  Loader2, Plus, Search, ChevronDown, Check, Trash2, Undo2, Redo2, Menu, LogOut, ArrowRight, Save, Cloud,
  Sparkles, FileText, StickyNote, Image as ImageIcon, Link as LinkIcon, BarChart2, LayoutGrid, Palette, Users, Clock, Mail,
  Video, Mic, ClipboardList, Package, Film, Type, MousePointer2, GripHorizontal, CalendarRange, Beaker, Archive, ImagePlay, CirclePlay, Share2, Spline,
  Lock, Unlock, Copy, MessageSquare
} from 'lucide-react';

// App Palette
const P = {
  PEACH: '#F9E6D1',
  YELLOW: '#FFD753',
  GREEN: '#3A5C34',
  PINK: '#FCCAE2',
  BURGUNDY: '#5F2427'
};

const getTabTheme = (baseColor: string | undefined) => {
    const color = baseColor || '#5F2427';
    switch (color) {
        case '#FFD753': return { text: '#854D0E', bg: color };
        case '#FCCAE2': return { text: '#9D174D', bg: color };
        case '#FF9500': return { text: '#C2410C', bg: color };
        default: return { text: color, bg: color };
    }
};

interface ToolButtonProps {
  icon: any;
  label: string;
  subLabel: string;
  bgColor: string;
  iconColor: string;
  onClick: () => void;
}

// --- DRAWER COMPONENT ---
const ToolButton: React.FC<ToolButtonProps> = ({ icon: Icon, label, subLabel, bgColor, iconColor, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-3 p-2.5 w-full rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group text-left">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: bgColor, color: iconColor }}>
      <Icon size={20} />
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[13px] font-semibold text-gray-900 leading-tight group-hover:text-[#5F2427] truncate">{label}</span>
      <span className="text-[11px] text-gray-400 leading-tight truncate">{subLabel}</span>
    </div>
  </button>
);

export default function App() {
  // --- Auth & Gatekeeper ---
  const {
    session, authLoading, authView, setAuthView,
    onboardingComplete, setOnboardingComplete,
    userProfile, brand, handleDismissTour,
  } = useAuth();

  // --- View / UI State (canvas + chrome) ---
  const [activeTool, setActiveTool] = useState<ToolType>('SELECT');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorPickerState, setColorPickerState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState("");
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState("");
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [templateModalState, setTemplateModalState] = useState<{ parentId: string | null } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // One-shot: id of a just-added card that Canvas should auto-select (so it opens expanded).
  const [pendingSelectCardId, setPendingSelectCardId] = useState<string | null>(null);
  // Recently-used card tools (most-recent first) for the canvas right-click quick row.
  const [recentTools, setRecentTools] = useState<CardType[]>(() => {
    try {
      const raw = localStorage.getItem('sosa_recent_tools');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* ignore */ }
    return DEFAULT_RECENT_TOOLS;
  });
  const recordToolUsed = (type: CardType) => {
    setRecentTools(prev => {
      const next = [type, ...prev.filter(t => t !== type)].slice(0, 8);
      try { localStorage.setItem('sosa_recent_tools', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  // --- Domain State (hooks) ---
  const {
    nodes, setNodes, activeNodeId, setActiveNodeId, nodesLoaded, saveError,
    handleUpdateNode, handleMoveNode, handleReorderNode,
    toggleFavorite, toggleExpand, getSortedChildren,
    getSnapshots, restoreFromSnapshot,
  } = useFileSystem({ session, onboardingComplete });

  // Guarded recovery overlay (?recover=1) — lists the local snapshot ring and
  // restores a prior tree through the normal gated save path. A safety hatch,
  // not everyday UI.
  const recoverMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('recover');

  // --- Publish reminders (Phase B: fires while the app is open) ---
  const [publishKitItem, setPublishKitItem] = useState<QueueItem | null>(null);

  // Update a card's content in ANY board. Active board goes through workspaces
  // state (so the canvas reflects it immediately); others patch the node tree.
  const updateCardAnywhere = (nodeId: string, workspaceId: string, cardId: string, newContent: any) => {
    if (nodeId === activeNodeId) {
      const updated = workspaces.map(w => w.id !== workspaceId ? w : ({
        ...w, cards: w.cards.map(c => c.id === cardId ? { ...c, content: newContent } : c)
      }));
      setWorkspaces(updated);
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], whiteboardData: updated } }));
    } else {
      setNodes(prev => {
        const node = prev[nodeId];
        if (!node || node.type !== 'whiteboard' || !node.whiteboardData) return prev;
        const newData = node.whiteboardData.map(ws => ws.id !== workspaceId ? ws : ({
          ...ws, cards: ws.cards.map(c => c.id === cardId ? { ...c, content: newContent } : c)
        }));
        return { ...prev, [nodeId]: { ...node, whiteboardData: newData } };
      });
    }
  };

  // Minute tick: due targets → needs_action + notification + open the kit.
  // Idempotent (announced items are no longer 'scheduled'), so re-runs are safe.
  useEffect(() => {
    if (!session || !onboardingComplete || !nodesLoaded) return;
    const tick = () => {
      const due = dueTargets(collectQueue(nodes), Date.now());
      if (due.length === 0) return;
      // Group by card so one card's multiple targets update in one write.
      const byCard = new Map<string, QueueItem[]>();
      due.forEach(i => {
        const k = `${i.nodeId}|${i.workspaceId}|${i.card.id}`;
        byCard.set(k, [...(byCard.get(k) || []), i]);
      });
      byCard.forEach(items => {
        const { nodeId, workspaceId, card } = items[0];
        updateCardAnywhere(nodeId, workspaceId, card.id, markTargetsNeedAction(card.content, items.map(i => i.target.id)));
      });
      notifyDue(due);
      setPublishKitItem(due[0]);
    };
    const t = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, onboardingComplete, nodesLoaded, nodes]);

  // Brand-wide calendar events (the "marketing gantt").
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarEvents({ session, onboardingComplete });

  // --- Brands (workspaces) ---
  // One primitive: each brand owns its tree, calendar+events and feed. Views get
  // BRAND-FILTERED data; every mutation path keeps operating on the FULL maps.
  const { brands, activeBrandId, activeBrand, addBrand, renameBrand, updateBrandAvatar, updateBrandProfile, updateBrandFeedCadence, addBrandDraft, updateBrandDraft, removeBrandDraft, addBrandMember, updateBrandMember, removeBrandMember, switchBrand } = useBrandSpaces({
    session, onboardingComplete,
    fallbackName: brand?.name || userProfile?.full_name || 'My Brand',
  });
  const visibleNodes = useMemo(() => filterNodesByBrand(nodes, activeBrandId), [nodes, activeBrandId]);
  const visibleEvents = useMemo(() => events.filter(e => eventInBrand(e, activeBrandId)), [events, activeBrandId]);
  // Teams Phase 2 (owner side): publish each SHARED brand's slice to brand_data so
  // members can read it. Purely additive — the blob save path is untouched.
  const { sharedMap: ownedSharedMap, refresh: refreshSharedBrands } = useOwnerMirror({ session, nodesLoaded, nodes, events, brands });
  // The active brand's roster. If the brand is SHARED, it's the real DB roster
  // (members + pending invites + owner); otherwise the local Phase-1 one. Used by
  // card assignees, @mentions and the Members modal.
  const localRoster = useMemo(() => resolveRoster(activeBrand, userProfile), [activeBrand, userProfile]);
  const activeSharedId = ownedSharedMap[activeBrandId] ?? null;
  const ownerForRoster = useMemo(
    () => (userProfile ? { id: userProfile.id, name: userProfile.full_name, email: userProfile.email, avatarUrl: userProfile.avatar_url } : null),
    [userProfile],
  );
  const { roster: activeRoster, reloadRoster } = useSharedRoster({ sharedBrandId: activeSharedId, localRoster, owner: ownerForRoster });
  const [membersOpen, setMembersOpen] = useState(false);

  // Teams Phase 2 (member side): brands shared WITH me, and the read-only view of
  // one when opened. Never touches my own file_system.
  const memberBrands = useMemberBrands(session);
  // Accept an invite link (?invite=<token>) once signed in; survive the auth hop.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('invite');
    if (t) { try { localStorage.setItem('sosa_pending_invite', t); } catch { /* quota */ } url.searchParams.delete('invite'); window.history.replaceState({}, '', url.toString()); }
  }, []);
  useEffect(() => {
    if (!session || !onboardingComplete) return;
    let pending: string | null = null;
    try { pending = localStorage.getItem('sosa_pending_invite'); } catch { /* */ }
    if (!pending) return;
    try { localStorage.removeItem('sosa_pending_invite'); } catch { /* */ }
    memberBrands.acceptAndOpen(pending);
  }, [session, onboardingComplete]);

  // New brand = user-initiated: create it, seed its starter folders, go home.
  // (handleNavigate persists an open whiteboard before leaving; safe no-op otherwise.)
  const handleAddBrand = (name: string, icon?: string) => {
    const id = addBrand(name, icon);
    setNodes(prev => ({ ...prev, ...seedFoldersForBrand(id) }));
    handleNavigate('root');
  };
  const handleSwitchBrand = (id: string) => {
    switchBrand(id);
    handleNavigate('root'); // never leave the view pointing at another brand's node
  };

  const historyApi = useCanvasHistory();
  const { history, future, reset: resetHistory } = historyApi;

  const {
    workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, activeWorkspace,
    updateCards, updateCardsSilent, handleUndo, handleRedo, addCard,
    addTab, updateTabName, updateTabColor, deleteTab, reorderTabs, duplicateTab, toggleTabLock, updateCardComments,
    connectors, updateConnectors,
  } = useWorkspaces({ activeNodeId, setNodes, pan, scale, history: historyApi });

  // Tab drag-to-reorder: track which tab is being dragged and the live drop index.
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  // --- Board chat drawer ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'unresolved' | { cardId: string }>('all');
  const boardWindowRef = useRef<HTMLDivElement>(null);

  // Global connectors visibility (opt-in, shown only when toggled on). Default off.
  const [showConnectors, setShowConnectors] = useState(false);

  // Don't let a heavy video upload be abandoned by closing the tab — an unfinished
  // upload can only persist as an empty URL (a permanently blank card).
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (pendingUploadCount() > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  // --- Derived view info ---
  const realNode = nodes[activeNodeId];
  const isWhiteboardMode = realNode?.type === 'whiteboard';

  const generateId = () => `card-${Math.random().toString(36).substr(2, 9)}`;

  // --- Node creation / navigation orchestration (crosses fs + workspaces) ---
  const handleCreateNode = (type: NodeType, parentId: string | null) => {
    let effectiveParentId = parentId;
    if (!effectiveParentId && activeNodeId !== 'root' && activeNodeId !== 'recents' && activeNodeId !== 'favorites' && nodes[activeNodeId]?.type === 'folder') {
        effectiveParentId = activeNodeId;
    } else if (!effectiveParentId && (activeNodeId === 'root' || activeNodeId === 'recents' || activeNodeId === 'favorites')) {
        effectiveParentId = null;
    }

    if (type === 'whiteboard') {
        setTemplateModalState({ parentId: effectiveParentId });
        return;
    }

    const id = `${type}-${Date.now()}`;
    const newNode: FileSystemNode = {
        id, type, name: 'New Folder', parentId: effectiveParentId, order: Date.now(),
        spaceId: activeBrandId,
    };
    setNodes(prev => ({ ...prev, [id]: newNode }));
  };

  const handleSelectTemplate = (templateId: string | null) => {
      const parentId = templateModalState?.parentId || null;
      setTemplateModalState(null);

      const name = prompt(`Enter whiteboard name:`, templateId ? 'New Campaign' : 'Untitled Whiteboard');
      if (!name) return;

      const initialData = buildTemplate(templateId, generateId);

      const id = `whiteboard-${Date.now()}`;
      const newNode: FileSystemNode = {
          id, type: 'whiteboard', name, parentId, order: Date.now(), whiteboardData: initialData,
          spaceId: activeBrandId,
      };
      setNodes(prev => ({ ...prev, [id]: newNode }));
      // Pass the freshly-built node explicitly: handleNavigate would otherwise read
      // the not-yet-committed `nodes[id]` (stale closure) and skip loading the new
      // board into `workspaces`, leaving the previous board's cards in memory — which
      // then get mirrored into the new node on first edit (the duplication bug).
      handleNavigate(id, newNode);
  };

  const handleDeleteNode = (id: string) => {
      setNodes(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
      });
      if (activeNodeId === id) handleNavigate('root');
  };

  const handleExitWhiteboard = () => {
    if (realNode && realNode.parentId) {
        handleNavigate(realNode.parentId);
    } else {
        handleNavigate('root');
    }
  };

  // Single funnel for card-content writes from the OFF-canvas surfaces (Calendar +
  // Feed pages). Merges content (never blind-replaces → can't erase media) and then
  // runs reconcileCards so linked-post dates stay derived from their grid slot —
  // the SAME reconciliation the whiteboard's writeCards does. This guarantees a
  // change made on any surface is consistent across Calendar ↔ Feed ↔ whiteboard.
  const handleUpdateCardById = (nodeId: string, workspaceId: string, cardId: string, content: any) => {
    setNodes(prev => {
      const node = prev[nodeId];
      if (!node || node.type !== 'whiteboard' || !node.whiteboardData) return prev;
      const newData = node.whiteboardData.map(ws => {
        if (ws.id !== workspaceId) return ws;
        const merged = ws.cards.map(c => c.id === cardId ? { ...c, content: { ...(c.content as any), ...content } } : c);
        return { ...ws, cards: reconcileCards(merged) };
      });
      return { ...prev, [nodeId]: { ...node, whiteboardData: newData } };
    });
  };

  const handleNavigate = (id: string, nodeOverride?: FileSystemNode) => {
    // Persist current whiteboard back into the node tree before leaving.
    if (isWhiteboardMode && nodes[activeNodeId]) {
        setNodes(prev => ({
            ...prev,
            [activeNodeId]: { ...prev[activeNodeId], whiteboardData: workspaces }
        }));
    }
    // Prefer an explicitly-passed node (e.g. a just-created whiteboard whose setNodes
    // hasn't committed yet) so we never read a stale `nodes[id]`.
    const targetNode = nodeOverride ?? nodes[id];
    // Navigating into another brand's node (search, deep link) follows the node —
    // switch the active brand so the surrounding views stay consistent.
    if (targetNode && !nodeInBrand(targetNode, activeBrandId)) {
        switchBrand(targetNode.spaceId ?? DEFAULT_BRAND_ID);
    }
    // When opening a whiteboard, focus on the workspace that already has cards
    // (the busiest tab) and center the viewport on their bounding box, so we don't
    // land in empty space. Falls back to {0,0} when there are no cards.
    let focusPan: { x: number; y: number } | null = null;
    if (targetNode && targetNode.type === 'whiteboard') {
        // Deep-copy so `workspaces` never shares a reference with the node tree or the
        // DEFAULT_WHITEBOARD_DATA singleton (a shared ref let edits/deletes on one board
        // bleed into another / into the template).
        const wsData = JSON.parse(JSON.stringify(targetNode.whiteboardData || DEFAULT_WHITEBOARD_DATA));
        setWorkspaces(wsData);
        // Pick the workspace with the most cards (first one as fallback).
        const busiest = wsData.reduce(
            (best, ws) => (ws.cards.length > (best?.cards.length ?? -1) ? ws : best),
            wsData[0]
        );
        setActiveWorkspaceId(busiest?.id || 'tab-1');
        const cards = busiest?.cards || [];
        if (cards.length > 0) {
            const minX = Math.min(...cards.map(c => c.x));
            const minY = Math.min(...cards.map(c => c.y));
            const maxX = Math.max(...cards.map(c => c.x + (c.width || 0)));
            const maxY = Math.max(...cards.map(c => c.y + (c.height || 0)));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            // Canvas convention: screen = world * scale + pan (scale = 1 here).
            focusPan = { x: window.innerWidth / 2 - centerX, y: window.innerHeight / 2 - centerY };
        }
    }

    // Auto-expand parents in sidebar
    if (targetNode) {
        setNodes(prev => {
            const next = { ...prev };
            let currentId = targetNode.parentId;
            let changed = false;
            while (currentId && next[currentId]) {
                if (!next[currentId].isExpanded) {
                    next[currentId] = { ...next[currentId], isExpanded: true };
                    changed = true;
                }
                currentId = next[currentId].parentId;
            }
            return changed ? next : prev;
        });
    }

    setActiveNodeId(id);
    setScale(1);
    setPan(focusPan || { x: 0, y: 0 });
    resetHistory();
  };

  // Wrappers that bridge domain ops with local view state.
  const handleAddCard = (type: CardType, props: any = {}) => {
    const newId = addCard(type, props);
    recordToolUsed(type);
    setIsDrawerOpen(false);
    // Auto-select the new card so it renders EXPANDED while being placed; it
    // collapses on its own once the user clicks away (deselects).
    setPendingSelectCardId(newId);
  };

  const handleDeleteTab = (id: string) => {
    deleteTab(id);
    setColorPickerState(null);
  };

  // --- Board chat handlers ---
  const boardChatMessages: BoardChatMessage[] = nodes[activeNodeId]?.boardChat || [];

  // Total open items (board messages + card comments) for the trigger bubble.
  const unresolvedChatCount = useMemo(() => {
    const boardCount = boardChatMessages.filter(m => !m.resolved).length;
    const cardCount = workspaces.reduce((sum, w) =>
      sum + w.cards.reduce((s, c) =>
        s + ((((c.content as any)?.comments || []) as Comment[]).filter(cm => !cm.resolved).length), 0), 0);
    return boardCount + cardCount;
  }, [boardChatMessages, workspaces]);

  const handleSendChatMessage = (text: string, cardId?: string, mentions?: string[]) => {
    const msg: BoardChatMessage = {
      id: `msg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      text,
      createdAt: new Date().toISOString(),
      user: userProfile?.full_name || 'You',
      avatar: userProfile?.avatar_url,
      ...(cardId ? { cardId } : {}),
      ...(mentions && mentions.length ? { mentions } : {}),
    };
    handleUpdateNode(activeNodeId, { boardChat: [...(nodes[activeNodeId]?.boardChat || []), msg] });
  };

  const handleToggleResolveMessage = (id: string) => {
    const list = nodes[activeNodeId]?.boardChat || [];
    handleUpdateNode(activeNodeId, { boardChat: list.map(m => m.id === id ? { ...m, resolved: !m.resolved } : m) });
  };

  const handleToggleResolveCardComment = (workspaceId: string, cardId: string, commentId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    const card = ws?.cards.find(c => c.id === cardId);
    if (!ws || !card) return;
    const comments = (((card.content as any)?.comments || []) as Comment[])
      .map(c => c.id === commentId ? { ...c, resolved: !c.resolved } : c);
    updateCardComments(workspaceId, cardId, comments);
  };

  // Comment badge on a card → open the drawer filtered to that card.
  const handleOpenComments = (cardId: string) => {
    setIsChatOpen(true);
    setChatFilter({ cardId });
  };

  // Jump the board to a referenced card: switch sheet if needed, center the
  // viewport on it (using the BOARD WINDOW's size — the drawer offsets the
  // canvas), then select+expand via the existing one-shot mechanism.
  const handleJumpToCard = (cardId: string) => {
    const ws = workspaces.find(w => w.cards.some(c => c.id === cardId));
    if (!ws) return;
    const card = ws.cards.find(c => c.id === cardId)!;
    if (ws.id !== activeWorkspaceId) setActiveWorkspaceId(ws.id);
    const r = boardWindowRef.current?.getBoundingClientRect();
    const vw = r?.width ?? window.innerWidth;
    const vh = r?.height ?? window.innerHeight;
    const s = Math.min(Math.max(scale, 0.5), 1);
    setScale(s);
    setPan({
      x: vw / 2 - (card.x + (card.width || 340) / 2) * s,
      y: vh / 2 - (card.y + (card.height || 400) / 2) * s,
    });
    setPendingSelectCardId(cardId);
  };

  const toggleColorPicker = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (colorPickerState?.id === id) {
        setColorPickerState(null);
    } else {
        const rect = e.currentTarget.getBoundingClientRect();
        setColorPickerState({ id, x: rect.left + rect.width / 2, y: rect.top });
    }
  };

  // --- Displayed node + children (depends on active selection) ---
  // All listings are scoped to the ACTIVE BRAND (nodes without spaceId = default brand).
  const inBrand = (n: FileSystemNode) => nodeInBrand(n, activeBrandId);
  let displayedNode: FileSystemNode;
  let displayedChildren: FileSystemNode[] = [];

  if (activeNodeId === 'root') {
    displayedNode = { id: 'root', type: 'folder', name: 'Home', parentId: null };
    displayedChildren = getSortedChildren(n => inBrand(n) && (n.parentId === null || n.type === 'whiteboard'));
  } else if (activeNodeId === 'recents') {
    displayedNode = { id: 'recents', type: 'folder', name: 'Recents', parentId: null };
    displayedChildren = getSortedChildren(n => inBrand(n) && n.type !== 'folder');
  } else if (activeNodeId === 'favorites') {
    displayedNode = { id: 'favorites', type: 'folder', name: 'Favorites', parentId: null };
    displayedChildren = getSortedChildren(n => inBrand(n) && !!n.isFavorite);
  } else if (realNode) {
    displayedNode = realNode;
    displayedChildren = getSortedChildren(n => n.parentId === activeNodeId);
  } else {
    displayedNode = { id: 'error', type: 'folder', name: 'Not Found', parentId: null };
  }

  // Breadcrumbs
  const breadcrumbs: { id: string, name: string }[] = [];
  let curr = realNode;
  while (curr) {
      breadcrumbs.unshift({ id: curr.id, name: curr.name });
      curr = curr.parentId ? nodes[curr.parentId] : undefined;
  }

  // --- SHORTCUTS & EVENTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;

      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);

      // Undo/Redo Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
          if (e.shiftKey) {
              e.preventDefault();
              handleRedo();
          } else {
              e.preventDefault();
              handleUndo();
          }
      }

      if (!isSpacePressed && isWhiteboardMode) {
          if (e.key.toLowerCase() === 'v' || e.key === 'Escape') setActiveTool('SELECT');
          if (e.key.toLowerCase() === 'h') setActiveTool('PAN');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, isWhiteboardMode, handleUndo, handleRedo]);

  // --- DRAWER TOOLS DATA STRUCTURE ---
  const toolsData = useMemo(() => [
    {
      category: 'Instagram',
      items: [
        { icon: ImageIcon, label: "Post Card", subLabel: "Social content & assets", bgColor: P.GREEN, iconColor: P.YELLOW, action: () => handleAddCard(CardType.POST) },
        { icon: LayoutGrid, label: "Feed Planner", subLabel: "Instagram layout", bgColor: P.PEACH, iconColor: P.BURGUNDY, action: () => handleAddCard(CardType.GRID_PLANNER) },
        { icon: CirclePlay, label: "Story Beat", subLabel: "Plan a day of stories", bgColor: P.BURGUNDY, iconColor: P.PEACH, action: () => handleAddCard(CardType.STORY, { width: 456, height: 476 }) },
        { icon: Video, label: "Reel / TikTok", subLabel: "Short-form video", bgColor: P.PINK, iconColor: P.BURGUNDY, action: () => handleAddCard(CardType.REELS, { width: 440, height: 480 }) },
        // Hidden tools
        { icon: Type, label: "Typography", subLabel: "Headings & notes", bgColor: P.PEACH, iconColor: P.BURGUNDY, action: () => setActiveTool('TEXT'), hidden: true },
        { icon: StickyNote, label: "Sticky Note", subLabel: "Quick thoughts", bgColor: P.YELLOW, iconColor: P.GREEN, action: () => setActiveTool('STICKY'), hidden: true },
        { icon: Mail, label: "Newsletter", subLabel: "Email campaigns", bgColor: P.BURGUNDY, iconColor: P.PINK, action: () => handleAddCard(CardType.NEWSLETTER), hidden: true },
      ]
    },
    {
      category: 'Strategy',
      hidden: false,
      items: [
        { icon: Sparkles, label: "Oracle AI", subLabel: "Generate hooks & ideas", bgColor: P.PINK, iconColor: P.BURGUNDY, action: () => handleAddCard(CardType.STRATEGY_AI), hidden: true },
        { icon: BarChart2, label: "Analytics", subLabel: "KPI tracking", bgColor: P.GREEN, iconColor: P.PEACH, action: () => handleAddCard(CardType.ANALYTICS), hidden: true },
        { icon: CalendarRange, label: "Timeline", subLabel: "Gantt chart", bgColor: P.YELLOW, iconColor: P.BURGUNDY, action: () => handleAddCard(CardType.GANTT) },
        { icon: Beaker, label: "The Lab", subLabel: "A/B Testing", bgColor: P.BURGUNDY, iconColor: P.YELLOW, action: () => handleAddCard(CardType.ADS_TEST), hidden: true },
        { icon: ImagePlay, label: "Reference", subLabel: "Inspiration & mood", bgColor: P.PEACH, iconColor: P.GREEN, action: () => handleAddCard(CardType.REFERENCE) },
      ]
    },
    {
      category: 'Production',
      hidden: false,
      items: [
        { icon: Film, label: "Storyboard", subLabel: "Visual sequencing", bgColor: P.PEACH, iconColor: P.GREEN, action: () => handleAddCard(CardType.FILMSTRIP), hidden: true },
        { icon: FileText, label: "Script", subLabel: "A/V dual column", bgColor: P.PINK, iconColor: P.GREEN, action: () => handleAddCard(CardType.AV_SCRIPT), hidden: true },
        { icon: ClipboardList, label: "Call Sheet", subLabel: "Shoot logistics", bgColor: P.GREEN, iconColor: P.PINK, action: () => handleAddCard(CardType.CALL_SHEET) },
        { icon: Users, label: "Casting", subLabel: "Talent management", bgColor: P.YELLOW, iconColor: P.GREEN, action: () => handleAddCard(CardType.CASTING_BOARD), hidden: true },
        { icon: Package, label: "Props", subLabel: "Inventory list", bgColor: P.BURGUNDY, iconColor: P.PEACH, action: () => handleAddCard(CardType.PROP_TABLE) },
      ]
    },
    {
      category: 'Connectors',
      hidden: true,
      items: [
        { icon: LinkIcon, label: "Pinterest", subLabel: "Board integration", bgColor: P.PINK, iconColor: P.BURGUNDY, action: () => handleAddCard(CardType.PINTEREST) },
      ]
    },
    { category: 'TikTok', comingSoon: true, items: [] },
    { category: 'Youtube', comingSoon: true, items: [] },
    { category: 'Paid Media', comingSoon: true, items: [] },
    { category: 'Email Marketing', comingSoon: true, items: [] }
  ], [handleAddCard]);

  // --- FILTERING LOGIC ---
  const displayedTools = useMemo(() => {
    const visibleCategories = toolsData
        .filter(cat => !cat.hidden)
        .map(cat => ({
            ...cat,
            items: cat.items ? cat.items.filter(item => !(item as any).hidden) : []
        }));

    if (!searchTerm.trim()) return visibleCategories;

    const lowerTerm = searchTerm.toLowerCase();

    const flatItems = visibleCategories.flatMap(cat => cat.items).filter(item =>
        item.label.toLowerCase().includes(lowerTerm) ||
        item.subLabel.toLowerCase().includes(lowerTerm)
    );

    return flatItems.length > 0
      ? [{ category: 'Search Results', items: flatItems }]
      : [];
  }, [searchTerm, toolsData]);

  // --- RENDER CONDITIONAL VIEWS ---
  if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#F9F8F6]"><Loader2 size={32} className="text-[#3A5C34] animate-spin" /></div>;
  if (!session) {
    if (authView === 'login') return <LoginForm onRegisterClick={() => setAuthView('register')} />;
    return <RegisterForm onLoginClick={() => setAuthView('login')} />;
  }
  if (!onboardingComplete) return <OnboardingFlow userId={session.user.id} onComplete={() => setOnboardingComplete(true)} />;
  // Wait for the initial nodes load so we never flash an empty home page.
  if (!nodesLoaded) return <div className="h-screen w-full flex items-center justify-center bg-[#F9F8F6]"><Loader2 size={32} className="text-[#3A5C34] animate-spin" /></div>;

  // --- SHARED BRAND (member, read-only) — replaces the app while open ---
  if (memberBrands.activeSharedId) {
    if (!memberBrands.sharedData || !memberBrands.activeShared) {
      return <div className="h-screen w-full flex items-center justify-center bg-[#F9F8F6]"><Loader2 size={32} className="text-[#3A5C34] animate-spin" /></div>;
    }
    return (
      <SharedBrandView
        shared={memberBrands.activeShared}
        data={memberBrands.sharedData}
        me={{ name: userProfile?.full_name || 'You', avatarUrl: userProfile?.avatar_url }}
        onExit={memberBrands.closeShared}
      />
    );
  }

  // --- MAIN APP ---
  return (
    <BrandIdentityProvider value={{
      brandName: activeBrand?.name || brand?.name || userProfile?.full_name || 'Your brand',
      avatarUrl: activeBrand?.avatarUrl || (activeBrandId === DEFAULT_BRAND_ID ? (brand?.logo_url || userProfile?.avatar_url) : undefined),
      socialProfiles: activeBrand?.socialProfiles,
      members: activeRoster,
    }}>
    <div className="flex w-full h-screen bg-white text-[#1C1C1E] overflow-hidden font-sans">

      {/* Save-failure banner — the user must never lose work silently. The retry
          watchdog keeps trying in the background; this just makes it visible. */}
      {saveError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 px-4 h-10 rounded-xl bg-[#5F2427] text-[#F9E6D1] shadow-lg text-[13px] font-semibold animate-in fade-in slide-in-from-top-2">
          <Loader2 size={14} className="animate-spin" />
          Can’t reach the server — retrying. Keep this tab open.
        </div>
      )}


      {/* Sidebar (Main Navigation) */}
      {isSidebarOpen && !isWhiteboardMode && (
        <Sidebar
          nodes={visibleNodes}
          activeNodeId={activeNodeId}
          userProfile={userProfile}
          brand={brand}
          brandSpaces={brands}
          activeBrandId={activeBrandId}
          onSwitchBrand={handleSwitchBrand}
          onAddBrand={handleAddBrand}
          onOpenMembers={() => setMembersOpen(true)}
          sharedWithMe={memberBrands.sharedWithMe}
          onOpenSharedBrand={memberBrands.openShared}
          onRenameBrand={renameBrand}
          onUpdateBrandAvatar={updateBrandAvatar}
          onNavigate={handleNavigate}
          onToggleExpand={toggleExpand}
          onCreateNode={handleCreateNode}
          onToggleFavorite={toggleFavorite}
          onMoveNode={handleMoveNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 relative flex flex-col h-full min-w-0">
         {!isSidebarOpen && !isWhiteboardMode && (
             <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 text-gray-500"><Menu size={16} /></button>
         )}

         {isWhiteboardMode ? (
            <div className="w-full h-full flex flex-row bg-[#F2F2F7] overflow-hidden">
              {/* Chat drawer — LEFT; a floating rounded panel that's the twin of the
                  board window, so opening it turns the workspace into two windows. */}
              <div className={`shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isChatOpen ? 'w-[400px]' : 'w-0'}`}>
                {isChatOpen && (
                  <div className="h-full py-4 pl-4">
                    <div className="h-full w-full rounded-3xl overflow-hidden bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[#5F2427]/10">
                      <BoardChatDrawer
                        workspaces={workspaces}
                        messages={boardChatMessages}
                        filter={chatFilter}
                        onFilterChange={setChatFilter}
                        onSend={handleSendChatMessage}
                        onToggleResolveMessage={handleToggleResolveMessage}
                        onToggleResolveCardComment={handleToggleResolveCardComment}
                        onJumpToCard={handleJumpToCard}
                        onClose={() => setIsChatOpen(false)}
                        members={activeRoster}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Board window — full-bleed normally; padded rounded window while chatting. */}
              <div
                ref={boardWindowRef}
                className={`relative flex-1 min-w-0 bg-[#F9F8F6] transition-[margin,border-radius] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isChatOpen ? 'my-4 mr-4 ml-4 rounded-3xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[#5F2427]/10' : ''}`}
              >
                <Canvas
                    cards={activeWorkspace.cards}
                    onCardsChange={updateCards}
                    onCardsChangeSilent={updateCardsSilent}
                    activeTool={activeTool}
                    onToolUsed={() => setActiveTool('SELECT')}
                    scale={scale}
                    onScaleChange={setScale}
                    pan={pan}
                    onPanChange={setPan}
                    isSpacePressed={isSpacePressed}
                    selectCardId={pendingSelectCardId}
                    onCardSelected={() => setPendingSelectCardId(null)}
                    recentTools={recentTools}
                    onQuickToolUsed={recordToolUsed}
                    connectors={connectors}
                    onConnectorsChange={updateConnectors}
                    showConnectors={showConnectors}
                    readOnly={!!activeWorkspace?.isLocked}
                    onOpenComments={handleOpenComments}
                />

                {/* Header (Top Right) */}
                <div className="absolute top-6 right-6 z-[50] flex items-center gap-3 no-drag">
                    {/* Breadcrumbs */}
                    <div className="hidden md:flex h-10 px-4 items-center gap-2 rounded-xl bg-white border border-[#5F2427]/10 shadow-sm select-none">
                        <span className="text-[13px] font-semibold text-[#5F2427] max-w-[120px] truncate opacity-70">
                            {realNode ? nodes[realNode.parentId || '']?.name || 'Workspace' : 'Workspace'}
                        </span>
                        <span className="text-[#FFD753] font-bold text-[14px]">/</span>
                        {isRenamingTitle ? (
                            <input autoFocus value={titleInputValue} onChange={(e) => setTitleInputValue(e.target.value)} onBlur={() => { if(titleInputValue.trim()) handleUpdateNode(activeNodeId, { name: titleInputValue.trim() }); setIsRenamingTitle(false); }} onKeyDown={(e) => { if(e.key === 'Enter') { if(titleInputValue.trim()) handleUpdateNode(activeNodeId, { name: titleInputValue.trim() }); setIsRenamingTitle(false); } if(e.key === 'Escape') setIsRenamingTitle(false); }} className="text-[13px] font-bold text-[#5F2427] bg-transparent border-none outline-none p-0 w-[160px] focus:ring-0" />
                        ) : (
                            <span onDoubleClick={(e) => { e.stopPropagation(); setIsRenamingTitle(true); setTitleInputValue(displayedNode.name); }} className="text-[13px] font-bold text-[#5F2427] max-w-[160px] truncate cursor-text hover:bg-[#5F2427]/5 px-1 -mx-1 rounded transition-colors">{displayedNode.name}</span>
                        )}
                    </div>

                    {/* Zoom / Undo / Redo Control Bar */}
                    <div className="h-10 flex items-center rounded-xl bg-white border border-[#5F2427]/10 shadow-sm overflow-hidden select-none">
                        <div className="px-3 h-full flex items-center justify-center bg-[#3A5C34]/5">
                            <span className="text-[13px] font-bold text-[#3A5C34] min-w-[32px] text-center">
                                {Math.round(scale * 100)}%
                            </span>
                        </div>

                        <div className="w-px h-full bg-[#3A5C34]/10" />

                        <button
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="h-full px-3 flex items-center justify-center text-[#3A5C34] hover:bg-[#3A5C34]/10 active:bg-[#3A5C34]/20 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <Undo2 size={18} />
                        </button>

                        <div className="w-px h-full bg-[#3A5C34]/10" />

                        <button
                            onClick={handleRedo}
                            disabled={future.length === 0}
                            className="h-full px-3 flex items-center justify-center text-[#3A5C34] hover:bg-[#3A5C34]/10 active:bg-[#3A5C34]/20 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <Redo2 size={18} />
                        </button>

                        <div className="w-px h-full bg-[#3A5C34]/10" />

                        <button
                            onClick={() => setShowConnectors(v => !v)}
                            title={showConnectors ? 'Hide connectors' : 'Show connectors'}
                            className={`h-full px-3 flex items-center justify-center transition-all ${showConnectors ? 'text-[#3A5C34] hover:bg-[#3A5C34]/10' : 'text-gray-300 hover:bg-gray-100'}`}
                        >
                            <Spline size={18} />
                        </button>
                    </div>

                    {/* Share Button */}
                    <button onClick={() => setShareModalOpen(true)} title="Share board" className="h-10 px-4 rounded-xl bg-[#5F2427] shadow-sm border border-[#FCCAE2]/10 flex items-center gap-2 text-[#FCCAE2] text-[13px] font-bold hover:bg-[#4a1c1f] hover:scale-[1.02] active:scale-95 transition-all">
                        <Share2 size={16} strokeWidth={2.5} /> Share
                    </button>

                    {/* Exit Button */}
                    <button onClick={handleExitWhiteboard} className="h-10 w-10 rounded-xl bg-[#FCCAE2] shadow-sm border border-[#5F2427]/10 flex items-center justify-center text-[#5F2427] hover:bg-[#ffb4d6] hover:scale-105 active:scale-95 transition-all">
                        <LogOut size={18} strokeWidth={2.5} className="ml-0.5" />
                    </button>
                </div>

                {/* Left Hover Drawer Trigger */}
                <div
                    className="absolute top-0 left-0 bottom-0 w-3 z-30"
                    onMouseEnter={() => setIsDrawerOpen(true)}
                />

                {/* Explicit Open Drawer Button */}
                {!isDrawerOpen && (
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="absolute top-6 left-6 z-[40] w-10 h-10 bg-[#3A5C34] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-[#FFD753]/10 text-[#FFD753] flex items-center justify-center hover:scale-105 hover:bg-[#2d4a29] active:scale-95 transition-all"
                        title="Add Tools"
                    >
                        <Plus size={20} />
                    </button>
                )}

                {/* --- TOOL DRAWER --- */}
                <div
                    className={`absolute inset-y-0 left-0 z-50 flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
                    onMouseLeave={() => setIsDrawerOpen(false)}
                >
                    <div className="w-[320px] h-full bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col border-r border-gray-200/50">
                        {/* Drawer Header */}
                        <div className="p-5 bg-white/50 z-10 pt-8 sticky top-0 backdrop-blur-md flex flex-col gap-3">
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input placeholder="Find a tool..." className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-[13px] focus:ring-2 focus:ring-[#3A5C34]/20 placeholder-gray-400 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                             </div>

                             {/* Quick Actions */}
                             <div className="flex items-center gap-2 mt-2">
                                 <button
                                     onClick={() => setActiveTool('TEXT')}
                                     className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                                     style={{ backgroundColor: P.PEACH, color: P.BURGUNDY }}
                                     title="Typography"
                                 >
                                     <Type size={18} />
                                 </button>
                                 <button
                                     onClick={() => setActiveTool('STICKY')}
                                     className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                                     style={{ backgroundColor: P.YELLOW, color: P.GREEN }}
                                     title="Sticky Note"
                                 >
                                     <StickyNote size={18} />
                                 </button>
                                 <button
                                     onClick={() => handleAddCard(CardType.DOC, { width: 680, height: 800 })}
                                     className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                                     style={{ backgroundColor: P.BURGUNDY, color: P.PINK }}
                                     title="Document"
                                 >
                                     <FileText size={18} />
                                 </button>
                             </div>
                        </div>

                        {/* Tool Categories (Filtered List) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 no-scrollbar">
                            {displayedTools.length > 0 ? (
                                displayedTools.map((category, idx) => (
                                    <div key={idx} className="animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 75}ms` }}>
                                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">{category.category}</h3>
                                        {(category as any).comingSoon ? (
                                            <div className="px-2">
                                                <div className="inline-block px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-md">
                                                    Coming soon
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {category.items.map((tool, tIdx) => (
                                                    <ToolButton
                                                        key={tIdx}
                                                        icon={tool.icon}
                                                        label={tool.label}
                                                        subLabel={tool.subLabel}
                                                        bgColor={tool.bgColor}
                                                        iconColor={tool.iconColor}
                                                        onClick={tool.action}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-center px-4">
                                    <Archive size={32} className="mb-2 opacity-20" />
                                    <p className="text-[13px] font-medium">No tools found</p>
                                    <p className="text-[11px]">Try searching for something else.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Left Tabs */}
                <div className="absolute bottom-6 left-6 z-40 flex items-end justify-start gap-2 pointer-events-none">
                    {/* Board chat trigger — square button styled like the exit button */}
                    <button
                        onClick={() => setIsChatOpen(v => !v)}
                        title={isChatOpen ? 'Close board chat' : 'Board chat'}
                        className={`pointer-events-auto relative h-10 w-10 rounded-xl shadow-sm border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isChatOpen ? 'bg-[#5F2427] border-[#FCCAE2]/10 text-[#FCCAE2]' : 'bg-[#FCCAE2] border-[#5F2427]/10 text-[#5F2427] hover:bg-[#ffb4d6]'}`}
                    >
                        <MessageSquare size={18} strokeWidth={2.5} />
                        {unresolvedChatCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5F2427] text-[#FCCAE2] text-[10px] font-bold flex items-center justify-center border-2 border-[#F9F8F6]">
                                {unresolvedChatCount > 99 ? '99+' : unresolvedChatCount}
                            </span>
                        )}
                    </button>
                    <div className="pointer-events-auto flex items-center h-10 bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden max-w-[calc(100vw-448px)]">
                        <div className="flex items-center overflow-x-auto no-scrollbar h-full">
                            {workspaces.map((ws, idx) => {
                                const isActive = activeWorkspaceId === ws.id;
                                const { text: textColor, bg: activeColor } = getTabTheme(ws.color);
                                const bgOpacity = isActive ? '1A' : (hoveredTabId === ws.id ? '0D' : '00');
                                return (
                                    <div key={ws.id || `ws-${idx}`} className="relative group h-full flex flex-shrink-0">
                                        {/* Live drop indicator (left edge) while reordering */}
                                        {dragOverTabIndex === idx && draggingTabId && draggingTabId !== ws.id && (
                                            <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#3A5C34] z-10" />
                                        )}
                                        <div
                                            draggable={!editingTabId}
                                            onDragStart={(e) => { setDraggingTabId(ws.id); e.dataTransfer.effectAllowed = 'move'; }}
                                            onDragOver={(e) => { e.preventDefault(); if (draggingTabId && draggingTabId !== ws.id) setDragOverTabIndex(idx); }}
                                            onDragEnd={() => { setDraggingTabId(null); setDragOverTabIndex(null); }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (draggingTabId) {
                                                    const from = workspaces.findIndex(w => w.id === draggingTabId);
                                                    if (from !== -1 && from !== idx) reorderTabs(from, idx);
                                                }
                                                setDraggingTabId(null); setDragOverTabIndex(null);
                                            }}
                                            onClick={() => !editingTabId && setActiveWorkspaceId(ws.id)}
                                            onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingTabId(ws.id); setEditTabName(ws.name); setColorPickerState(null); }}
                                            onMouseEnter={() => setHoveredTabId(ws.id)}
                                            onMouseLeave={() => setHoveredTabId(null)}
                                            className={`px-4 h-full flex items-center gap-2 text-[13px] transition-all duration-200 border-r border-gray-100 select-none min-w-[100px] cursor-pointer ${isActive ? 'font-bold' : 'font-medium text-gray-500'} ${draggingTabId === ws.id ? 'opacity-40' : ''}`}
                                            style={{ color: (isActive || hoveredTabId === ws.id) ? textColor : undefined, backgroundColor: (isActive || hoveredTabId === ws.id) ? `${activeColor}${bgOpacity}` : 'transparent' }}
                                        >
                                            {editingTabId === ws.id ? (
                                                <input autoFocus value={editTabName} onChange={(e) => setEditTabName(e.target.value)} onBlur={() => { if (editingTabId && editTabName.trim()) updateTabName(editingTabId, editTabName.trim()); setEditingTabId(null); }} onKeyDown={(e) => { if(e.key === 'Enter') { if (editingTabId && editTabName.trim()) updateTabName(editingTabId, editTabName.trim()); setEditingTabId(null); } if(e.key === 'Escape') setEditingTabId(null); }} className="bg-transparent border-none outline-none p-0 w-[100px] text-inherit font-inherit" />
                                            ) : (
                                                <span className="truncate max-w-[120px] flex items-center gap-1.5">{ws.isLocked && <Lock size={11} className="shrink-0 opacity-70" />}{ws.name}</span>
                                            )}
                                            {isActive && !editingTabId && <div onClick={(e) => toggleColorPicker(e, ws.id)} className="p-0.5 rounded hover:bg-black/5 cursor-pointer ml-1"><ChevronDown size={10} strokeWidth={3} /></div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={addTab} className="w-10 h-full flex items-center justify-center text-[#3A5C34] hover:bg-[#3A5C34]/10 transition-colors border-l border-[#5F2427]/5 flex-shrink-0"><Plus size={18} strokeWidth={2.5} /></button>
                    </div>
                </div>

                {/* Color Picker Popover */}
                {colorPickerState && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute bg-white/80 backdrop-blur-xl border border-white/40 p-3 rounded-2xl shadow-xl flex flex-col gap-3 w-56 z-[100]" style={{ left: colorPickerState.x, top: colorPickerState.y - 12, transform: 'translate(-50%, -100%)' }}>
                        <div className="grid grid-cols-7 gap-1.5">
                            {TAB_COLORS.map(c => <button key={c} onClick={() => updateTabColor(colorPickerState!.id, c)} className="w-6 h-6 rounded-full shadow-sm flex items-center justify-center transition-transform hover:scale-110 active:scale-95 border border-black/5" style={{ backgroundColor: c }}>{workspaces.find(w => w.id === colorPickerState!.id)?.color === c && <Check size={12} className="text-white drop-shadow-md" />}</button>)}
                        </div>
                        <div className="h-px bg-black/5 w-full my-0.5"></div>
                        <button onClick={() => { duplicateTab(colorPickerState!.id); setColorPickerState(null); }} className="flex items-center gap-2 px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-[13px] font-medium transition-colors w-full"><Copy size={14} /><span>Duplicate</span></button>
                        <button onClick={() => { toggleTabLock(colorPickerState!.id); setColorPickerState(null); }} className="flex items-center gap-2 px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-[13px] font-medium transition-colors w-full">{workspaces.find(w => w.id === colorPickerState!.id)?.isLocked ? <><Unlock size={14} /><span>Unlock</span></> : <><Lock size={14} /><span>Lock</span></>}</button>
                        <button onClick={() => handleDeleteTab(colorPickerState!.id)} className="flex items-center gap-2 px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-[13px] font-medium transition-colors w-full"><Trash2 size={14} /><span>Delete Tab</span></button>
                    </div>
                )}

                {/* Drawing Toolbar */}
                {['PEN', 'HIGHLIGHTER', 'ERASER', 'LASSO'].includes(activeTool) && (
                    <DrawingToolbar activeTool={activeTool} onToolChange={setActiveTool} onClose={() => setActiveTool('SELECT')} />
                )}
              </div>
            </div>
         ) : activeNodeId === 'calendar' ? (
            <CalendarView
                nodes={visibleNodes}
                onNavigate={handleNavigate}
                events={visibleEvents}
                onAddEvent={(data) => addEvent({ ...data, spaceId: activeBrandId })}
                onUpdateEvent={updateEvent}
                onDeleteEvent={deleteEvent}
                onUpdateCard={handleUpdateCardById}
            />
         ) : activeNodeId === 'planner' ? (
            <FeedPlannerView
                nodes={visibleNodes}
                events={visibleEvents}
                brandName={activeBrand?.name || brand?.name || userProfile?.full_name || 'Your brand'}
                // A brand's own uploaded picture wins; only the default brand inherits
                // the onboarding logo / account avatar.
                avatarUrl={activeBrand?.avatarUrl || (activeBrandId === DEFAULT_BRAND_ID ? (brand?.logo_url || userProfile?.avatar_url) : undefined)}
                brandProfiles={activeBrand?.socialProfiles}
                onUpdateBrandProfile={(channel, patch) => updateBrandProfile(activeBrandId, channel, patch)}
                brandFeedCadence={activeBrand?.feedCadence}
                onUpdateFeedCadence={(channel, monthKey, cadence) => updateBrandFeedCadence(activeBrandId, channel, monthKey, cadence)}
                brandDrafts={activeBrand?.feedDrafts}
                onAddDraft={(draft) => addBrandDraft(activeBrandId, draft)}
                onUpdateDraft={(draftId, patch) => updateBrandDraft(activeBrandId, draftId, patch)}
                onRemoveDraft={(draftId) => removeBrandDraft(activeBrandId, draftId)}
                onNavigate={handleNavigate}
                onUpdateCard={handleUpdateCardById}
            />
         ) : (
            <PageView
                node={displayedNode}
                childNodes={displayedChildren}
                breadcrumbs={breadcrumbs}
                onNavigate={handleNavigate}
                onCreateWhiteboard={() => handleCreateNode('whiteboard', activeNodeId === 'root' ? null : activeNodeId)}
                onCreateFolder={() => handleCreateNode('folder', activeNodeId === 'root' ? null : activeNodeId)}
                onToggleFavorite={toggleFavorite}
                onUpdateNode={handleUpdateNode}
                onReorderNode={handleReorderNode}
                tourCompleted={userProfile?.tour_completed}
                onDismissTour={handleDismissTour}
                roster={activeRoster}
                onShare={() => setMembersOpen(true)}
            />
         )}
      </div>

      {templateModalState && (
          <TemplateModal
              onClose={() => setTemplateModalState(null)}
              onSelectTemplate={handleSelectTemplate}
          />
      )}

      {shareModalOpen && isWhiteboardMode && realNode && (
          <ShareModal
              whiteboardId={activeNodeId}
              boardName={realNode.name}
              onClose={() => setShareModalOpen(false)}
          />
      )}

      {/* Publish kit — a scheduled target came due (Phase B semi-auto publishing) */}
      {publishKitItem && (
        <PublishKitModal
          item={publishKitItem}
          onMarkPublished={() => {
            const { nodeId, workspaceId, card, target } = publishKitItem;
            updateCardAnywhere(nodeId, workspaceId, card.id, setTargetStatus(card.content, target.id, 'published'));
            setPublishKitItem(null);
          }}
          onDismiss={() => setPublishKitItem(null)}
        />
      )}

      {/* Recovery overlay — ?recover=1 only. Restore a prior local snapshot. */}
      {recoverMode && session && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-8">
          <div className="w-full max-w-[460px] max-h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F2427]">Recovery</div>
              <div className="text-[15px] font-bold text-gray-900">Restore a local snapshot</div>
              <div className="text-[12px] text-gray-400 mt-0.5">Local backups of your workspace, newest first. Restoring re-saves through the normal path.</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
              {getSnapshots().length === 0 ? (
                <div className="py-10 text-center text-[13px] text-gray-400">No snapshots yet</div>
              ) : getSnapshots().map(s => {
                let count = 0;
                try { count = Object.keys(JSON.parse(s.serialized)).length; } catch { /* ignore */ }
                return (
                  <button
                    key={s.ts}
                    onClick={() => {
                      if (restoreFromSnapshot(s.ts)) {
                        window.location.href = window.location.pathname; // drop ?recover, reload clean
                      }
                    }}
                    className="w-full mb-2 p-3 rounded-2xl border border-gray-100 bg-white hover:border-[#3A5C34]/30 text-left flex items-center justify-between gap-3 transition-colors"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-gray-800">{new Date(s.ts).toLocaleString()}</span>
                      <span className="block text-[11px] text-gray-400">{count} items</span>
                    </span>
                    <span className="text-[12px] font-bold text-[#3A5C34] shrink-0">Restore</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-gray-100">
              <button onClick={() => { window.location.href = window.location.pathname; }} className="w-full h-10 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-200 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {membersOpen && (
        <MembersModal
          brandName={activeBrand?.name || 'Your brand'}
          roster={activeRoster}
          canManage
          onInvite={async (email, role) => {
            const invite = await createEmailInvite(
              activeBrandId,
              activeBrand?.name || 'Brand',
              email,
              role,
            );
            if (!invite) return null;
            await refreshSharedBrands();
            await reloadRoster();
            return `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
          }}
          onChangeRole={(id, role) => {
            const sharedId = ownedSharedMap[activeBrandId];
            if (!sharedId || id.startsWith('invite:') || id.startsWith('owner:')) return;
            updateMemberRole(sharedId, id, role).then(reloadRoster);
          }}
          onRemove={(id) => {
            const sharedId = ownedSharedMap[activeBrandId];
            if (!sharedId || id.startsWith('owner:')) return;
            if (id.startsWith('invite:')) { revokeInvite(id.slice('invite:'.length)).then(reloadRoster); return; }
            removeMember(sharedId, id).then(reloadRoster);
          }}
          onClose={() => setMembersOpen(false)}
        />
      )}
    </div>
    </BrandIdentityProvider>
  );
}
