import React, { useState, useMemo } from 'react';
import { FileSystemNode, Workspace, CardData, CardType, PostCardContent, PostStatus, CalendarEvent } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Filter, LayoutGrid, FileText, ClipboardList, Mail, CalendarRange, Film, MoreHorizontal, Pencil, Check, CirclePlay, Plus, Star, Flag, Send, CalendarOff } from 'lucide-react';
import { collectQueue, PLATFORM_META } from '../services/publishReminders';
import { resolveDateWrites } from '../services/gridPlanner';
import { toISODate, parseISODate } from '../services/dateUtils';
import { EventModal, getEventConfig } from './modals/EventModal';
import { soundService } from '../services/soundService';
import { StoryPreviewModal } from './modals/StoryPreviewModal';
import { ReelsPreviewModal } from './modals/ReelsPreviewModal';
import { PostCard } from './cards/PostCard';
import { NewsletterCard } from './cards/NewsletterCard';
import { GanttCard } from './cards/GanttCard';
import { CallSheetCard } from './cards/Production/CallSheetCard';
import { InstagramPreviewModal } from './modals/InstagramPreviewModal';

// Which content field holds each card type's date (used for drag-to-reschedule).
const DATE_FIELD: Partial<Record<CardType, string>> = {
  [CardType.POST]: 'date',
  [CardType.NEWSLETTER]: 'sendTime',
  [CardType.GANTT]: 'startDate',
  [CardType.CALL_SHEET]: 'shootDate',
  [CardType.STORY]: 'date',
  [CardType.REELS]: 'date',
};

interface CalendarViewProps {
  nodes: Record<string, FileSystemNode>;
  onNavigate: (id: string) => void;
  onUpdateCard: (nodeId: string, workspaceId: string, cardId: string, content: any) => void;
  events: CalendarEvent[];
  onAddEvent: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => string;
  onUpdateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  onDeleteEvent: (id: string) => void;
}

// Local date helpers for event range math (LOCAL, never toISOString).
const shiftISODays = (iso: string, days: number) => {
  const d = parseISODate(iso); d.setDate(d.getDate() + days); return toISODate(d);
};
const isoDayDiff = (a: string, b: string) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);

const STATUS_COLORS: Record<string, string> = {
  'Idea': 'bg-gray-100 text-gray-600',
  'In Production': 'bg-blue-500 text-white',
  'Ready': 'bg-orange-500 text-white',
  'Scheduled': 'bg-purple-500 text-white',
  'Published': 'bg-green-500 text-white',
  'Needs Review': 'bg-red-500 text-white'
};

const getCardIcon = (type: CardType) => {
  switch (type) {
    case CardType.POST: return <FileText size={12} />;
    case CardType.NEWSLETTER: return <Mail size={12} />;
    case CardType.GANTT: return <CalendarRange size={12} />;
    case CardType.CALL_SHEET: return <Film size={12} />;
    case CardType.STORY: return <CirclePlay size={12} />;
    case CardType.REELS: return <Film size={12} />;
    default: return <LayoutGrid size={12} />;
  }
};

const getCardTitle = (card: CardData) => {
  return (card.content as any)?.title || 'Untitled';
};

const getCardStatus = (card: CardData) => {
  return (card.content as any)?.status || 'Idea';
};

export const CalendarView: React.FC<CalendarViewProps> = ({ nodes, onNavigate, onUpdateCard, events, onAddEvent, onUpdateEvent, onDeleteEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'quarter'>('month');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<{ card: CardData, nodeId: string, workspaceId: string } | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // --- Calendar events (marketing gantt) ---
  const [showEvents, setShowEvents] = useState(true);
  const [eventModal, setEventModal] = useState<{ event?: CalendarEvent; defaultDate?: string } | null>(null);
  const [eventDrag, setEventDrag] = useState<CalendarEvent | null>(null);

  // Events covering a given day (start <= day <= end), sorted important-first then by start.
  const eventsOnDate = (dateStr: string): CalendarEvent[] => {
    if (!showEvents) return [];
    return events
      .filter(ev => {
        const end = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
        return ev.startDate <= dateStr && dateStr <= end;
      })
      .sort((a, b) => (Number(!!b.important) - Number(!!a.important)) || a.startDate.localeCompare(b.startDate));
  };

  const handleEventDropOnDate = (dateStr: string) => {
    if (!eventDrag) return;
    const delta = isoDayDiff(eventDrag.startDate, dateStr);
    const patch: Partial<CalendarEvent> = { startDate: dateStr };
    if (eventDrag.endDate) patch.endDate = shiftISODays(eventDrag.endDate, delta);
    onUpdateEvent(eventDrag.id, patch);
    setEventDrag(null);
  };

  // Renders one event as a (possibly connected) gantt segment inside a day cell.
  const renderEventBar = (ev: CalendarEvent, dateStr: string, minimal = false) => {
    const cfg = getEventConfig(ev.category);
    const bg = ev.color || cfg.color;
    const end = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
    const isStart = dateStr === ev.startDate;
    const isEnd = dateStr === end;
    const isWeekStart = parseISODate(dateStr).getDay() === 0;
    const showTitle = isStart || isWeekStart;
    const Icon = cfg.Icon;
    const rounding = `${isStart ? 'rounded-l-md ml-0.5' : ''} ${isEnd ? 'rounded-r-md mr-0.5' : ''}`;

    if (minimal) {
      return <div key={ev.id} title={ev.title} className={`h-1.5 ${rounding}`} style={{ background: bg }} />;
    }

    return (
      <div
        key={ev.id}
        draggable
        onDragStart={(e) => { setEventDrag(ev); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setEventDrag(null)}
        onClick={(e) => { e.stopPropagation(); setEventModal({ event: ev }); }}
        title={`${ev.title}${ev.owner ? ` • ${ev.owner}` : ''}`}
        className={`mb-0.5 h-5 flex items-center gap-1 px-1.5 cursor-pointer overflow-hidden ${rounding}`}
        style={{ background: bg, color: cfg.text }}
      >
        {showTitle && <Icon size={11} className="shrink-0 opacity-90" />}
        {showTitle ? (
          <span className="text-[10px] font-bold truncate leading-none flex-1">
            {ev.meta?.startTime ? <span className="opacity-80 font-semibold">{ev.meta.startTime} </span> : null}{ev.title}
          </span>
        ) : (
          <span className="text-[10px] font-bold opacity-70">▸</span>
        )}
        {showTitle && ev.important && <Star size={10} className="shrink-0 fill-current opacity-90" />}
      </div>
    );
  };

  // Extract all Dated Cards
  const allDatedCards = useMemo(() => {
    const items: { card: CardData, date: Date, label?: string, nodeId: string, workspaceId: string, folderId: string | null }[] = [];
    
    Object.values(nodes).forEach(node => {
      if (node.type === 'whiteboard' && node.whiteboardData) {
        node.whiteboardData.forEach(workspace => {
          workspace.cards.forEach(card => {
            if (!card.content) return;
            
            const addDate = (dateStr: string, label?: string) => {
              if (dateStr) {
                items.push({
                  card,
                  date: parseISODate(dateStr),
                  label,
                  nodeId: node.id,
                  workspaceId: workspace.id,
                  folderId: node.parentId
                });
              }
            };

            switch (card.type) {
              case CardType.POST:
                addDate((card.content as any).date);
                break;
              case CardType.NEWSLETTER:
                addDate((card.content as any).sendTime);
                break;
              case CardType.GANTT:
                addDate((card.content as any).startDate);
                break;
              case CardType.CALL_SHEET:
                addDate((card.content as any).shootDate);
                break;
              case CardType.STORY:
                addDate((card.content as any).date);
                break;
              case CardType.REELS:
                addDate((card.content as any).date);
                break;
            }
          });
        });
      }
    });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [nodes]);

  // Folders for filter
  const folders = useMemo(() => {
    return Object.values(nodes).filter(n => n.type === 'folder');
  }, [nodes]);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return allDatedCards.filter(p => {
      if (selectedFolderId !== 'all' && p.folderId !== selectedFolderId) return false;
      if (selectedStatus !== 'all' && getCardStatus(p.card) !== selectedStatus) return false;
      return true;
    });
  }, [allDatedCards, selectedFolderId, selectedStatus]);

  // --- Planning: drag-to-schedule state ---
  const [dragItem, setDragItem] = useState<{ card: CardData, nodeId: string, workspaceId: string } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [showTray, setShowTray] = useState(false);
  // Hovering the Unscheduled tray while dragging a dated post = unschedule it.
  const [overTray, setOverTray] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  // All scheduled publish targets across boards (sorted by time).
  const publishQueue = useMemo(() => collectQueue(nodes), [nodes]);

  // POST cards that have no date yet — schedulable from the tray.
  const unscheduled = useMemo(() => {
    const items: { card: CardData, nodeId: string, workspaceId: string, folderId: string | null }[] = [];
    Object.values(nodes).forEach(node => {
      if (node.type === 'whiteboard' && node.whiteboardData) {
        node.whiteboardData.forEach(ws => {
          ws.cards.forEach(card => {
            if ([CardType.POST, CardType.STORY, CardType.REELS].includes(card.type) && card.content && !(card.content as any).date) {
              items.push({ card, nodeId: node.id, workspaceId: ws.id, folderId: node.parentId });
            }
          });
        });
      }
    });
    return items.filter(p => selectedFolderId === 'all' || p.folderId === selectedFolderId);
  }, [nodes, selectedFolderId]);

  // Assign an item to a date — routes a Feed-Planner-linked post/reel through its
  // slot (single source of truth), else writes the card's own date field.
  // `dateStr = undefined` unschedules (and releases the linked slot, so
  // syncLinkedDates can't re-derive the date). Shared with the Feed page.
  const assignToDate = (item: { card: CardData, nodeId: string, workspaceId: string }, dateStr: string | undefined) => {
    const { card, nodeId, workspaceId } = item;
    const wsCards = nodes[nodeId]?.whiteboardData?.find(w => w.id === workspaceId)?.cards || [];
    resolveDateWrites(wsCards, card, dateStr, card.content, DATE_FIELD[card.type] || '')
      .forEach(w => onUpdateCard(nodeId, workspaceId, w.cardId, w.content));
  };

  const handleDropOnDate = (dateStr: string) => {
    if (dragItem) assignToDate(dragItem, dateStr);
    setDragItem(null);
    setDragOverDate(null);
  };

  // Only a post that HAS a date can be unscheduled — items dragged out of the
  // tray itself are already unscheduled, so the tray must not accept them back.
  const draggingDated = !!(dragItem && (dragItem.card.content as any)?.[DATE_FIELD[dragItem.card.type] || '']);

  /** Drag a dated post onto the Unscheduled tray (or click its button) → free the date. */
  const unschedule = (item: { card: CardData, nodeId: string, workspaceId: string }) => {
    assignToDate(item, undefined);
    soundService.play('snap');
    setDragItem(null);
    setDragOverDate(null);
    setOverTray(false);
  };

  // Click a day → modal to schedule an unscheduled item onto it or create an event.
  const [dayModal, setDayModal] = useState<string | null>(null);

  // Inline post rename (from the calendar event pill).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const commitRename = (item: { card: CardData, nodeId: string, workspaceId: string }) => {
    const val = renameValue.trim();
    if (val) onUpdateCard(item.nodeId, item.workspaceId, item.card.id, { ...item.card.content, title: val });
    setRenamingId(null);
  };

  // Calendar Logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const getDaysInWeek = () => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    return Array.from({ length: 7 }).map((_, i) => new Date(curr.setDate(first + i)));
  };

  // Calendar-quarter boundary (Q1 = Jan–Mar, Q2 = Apr–Jun, …) — the quarter view
  // always shows a real quarter, not "this month + the next two".
  const quarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);

  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else if (viewMode === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
    } else if (viewMode === 'quarter') {
      const qs = quarterStart(currentDate);
      setCurrentDate(new Date(qs.getFullYear(), qs.getMonth() - 3, 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else if (viewMode === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    } else if (viewMode === 'quarter') {
      const qs = quarterStart(currentDate);
      setCurrentDate(new Date(qs.getFullYear(), qs.getMonth() + 3, 1));
    }
  };

  // Mode-aware header label for the navigation bar.
  const periodLabel = () => {
    if (viewMode === 'quarter') {
      return `Q${Math.floor(currentDate.getMonth() / 3) + 1} ${currentDate.getFullYear()}`;
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const STATUS_DOT_COLORS: Record<string, string> = {
    'DRAFT': 'bg-gray-400',
    'IN_PROGRESS': 'bg-blue-500',
    'REVIEW': 'bg-yellow-500',
    'APPROVED': 'bg-green-500',
    'PUBLISHED': 'bg-purple-500'
  };

  const getPillColor = (type: CardType) => {
    switch (type) {
      case CardType.POST: return 'bg-[#3A5C34]/10 text-[#3A5C34] hover:bg-[#3A5C34]/20';
      case CardType.NEWSLETTER: return 'bg-[#FCCAE2]/40 text-[#5F2427] hover:bg-[#FCCAE2]/60';
      case CardType.GANTT: return 'bg-[#ffd753]/40 text-[#5F2427] hover:bg-[#ffd753]/60';
      case CardType.CALL_SHEET: return 'bg-[#5F2427]/10 text-[#5F2427] hover:bg-[#5F2427]/20';
      case CardType.ADS_TEST: return 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20';
      case CardType.STORY: return 'bg-[#5F2427]/10 text-[#5F2427] hover:bg-[#5F2427]/20';
      case CardType.REELS: return 'bg-[#FCCAE2]/50 text-[#5F2427] hover:bg-[#FCCAE2]/70';
      default: return 'bg-[#F9E6D1]/60 text-[#5F2427] hover:bg-[#F9E6D1]';
    }
  };

  const renderEvent = (post: typeof allDatedCards[0], minimal = false) => {
    const status = getCardStatus(post.card);
    const title = getCardTitle(post.card);
    const icon = getCardIcon(post.card.type);
    const fullTitle = `${title}${post.label ? ` (${post.label})` : ''}`;

    const dragProps = {
      draggable: true,
      onDragS