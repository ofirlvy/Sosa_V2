
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
import { ensureSharedBrand, createInvite, updateMemberRole, removeMember, revokeInvite } from './services/teamsBackend';
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