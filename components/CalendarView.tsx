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
      onDragStart: (e: React.DragEvent) => {
        setDragItem({ card: post.card, nodeId: post.nodeId, workspaceId: post.workspaceId });
        e.dataTransfer.effectAllowed = 'move';
        setShowTray(true); // dropping "out" needs a visible target
      },
      onDragEnd: () => { setDragItem(null); setDragOverDate(null); setOverTray(false); },
    };

    if (minimal) {
      return (
        <div
          key={post.card.id + (post.label || '')}
          {...dragProps}
          onClick={() => setSelectedCard(post)}
          className={`w-2 h-2 rounded-full cursor-pointer ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-gray-300'}`}
          title={`${fullTitle} - ${status}`}
        />
      );
    }

    const isRenaming = renamingId === post.card.id;

    return (
      <div
        key={post.card.id + (post.label || '')}
        {...(isRenaming ? {} : dragProps)}
        onClick={() => { if (!isRenaming) setSelectedCard(post); }}
        onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(post.card.id); setRenameValue(title); }}
        title={`${fullTitle} • ${status}`}
        className={`group mt-1 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing flex items-center gap-2 transition-colors h-6 ${getPillColor(post.card.type)}`}
      >
        <div className="flex-shrink-0 opacity-70">
          {icon}
        </div>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            dir="auto"
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={() => commitRename(post)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(post); if (e.key === 'Escape') setRenamingId(null); }}
            className="flex-1 min-w-0 bg-white/70 rounded px-1 text-[10px] font-semibold leading-none border-none focus:ring-0 outline-none"
          />
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold truncate leading-none">{title}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setRenamingId(post.card.id); setRenameValue(title); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              title="Rename"
            >
              <Pencil size={10} />
            </button>
            {/* Unschedule — deliberately NOT an "X", which reads as delete. */}
            <button
              onClick={(e) => { e.stopPropagation(); unschedule(post); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              title="Unschedule — send back to Unscheduled"
            >
              <CalendarOff size={10} />
            </button>
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[status] || 'bg-gray-400'}`} />
          </>
        )}
      </div>
    );
  };

  const renderDayCell = (date: Date, isCurrentMonth: boolean, dateStr: string | null, dayEvents: typeof allDatedCards, minimal = false) => {
    if (!dateStr || !isCurrentMonth) return null;
    
    const isToday = dateStr === toISODate(new Date());
    const isExpanded = expandedDays[dateStr];
    const maxVisible = 3;
    const displayEvents = isExpanded || minimal ? dayEvents : dayEvents.slice(0, maxVisible);
    const hiddenCount = dayEvents.length - maxVisible;
    const dayEventBars = eventsOnDate(dateStr);

    const isDropTarget = dragOverDate === dateStr;

    return (
      <div
        className={`group h-full flex flex-col ${minimal ? 'p-1' : 'p-2'} ${isToday ? 'bg-[#FCCAE2]/10' : ''} ${isDropTarget ? 'ring-2 ring-inset ring-[#3A5C34] bg-[#3A5C34]/5' : ''} transition-colors cursor-pointer`}
        onClick={() => setDayModal(dateStr)}
        onDragOver={(dragItem || eventDrag) ? (e) => { e.preventDefault(); setDragOverDate(dateStr); } : undefined}
        onDragLeave={() => { if (dragOverDate === dateStr) setDragOverDate(null); }}
        onDrop={(dragItem || eventDrag) ? (e) => { e.preventDefault(); if (eventDrag) handleEventDropOnDate(dateStr); else handleDropOnDate(dateStr); setDragOverDate(null); } : undefined}
      >
        <div className="mb-1 flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(date)); setViewMode('day'); }}
            title="Open this day"
            className={`w-6 h-6 flex items-center justify-center text-[12px] font-bold rounded-full transition-colors ${isToday ? 'bg-[#FCCAE2] text-[#5F2427]' : 'text-gray-500 font-medium hover:bg-gray-100'}`}
          >
            {date.getDate()}
          </button>
          {!minimal && (
            <button
              onClick={(e) => { e.stopPropagation(); setEventModal({ defaultDate: dateStr }); }}
              title="Add event"
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-[#3A5C34]/10 hover:text-[#3A5C34] transition-all"
            >
              <Plus size={13} />
            </button>
          )}
        </div>
        {/* Events band (marketing gantt) — above the content-card pills */}
        {dayEventBars.length > 0 && (
          <div className={`shrink-0 ${minimal ? 'flex flex-col gap-0.5 mb-1' : 'mb-1'}`}>
            {dayEventBars.map(ev => renderEventBar(ev, dateStr, minimal))}
          </div>
        )}
        <div className={`flex-1 overflow-y-auto no-scrollbar ${minimal ? 'flex flex-wrap gap-1 content-start' : 'flex flex-col'}`}>
          {displayEvents.map(e => renderEvent(e, minimal))}
          {!isExpanded && !minimal && hiddenCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(date)); setViewMode('day'); }}
              className="mt-1 px-2 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-500 text-[10px] font-bold text-left transition-colors h-6 flex items-center"
            >
              +{hiddenCount} more
            </button>
          )}
          {isExpanded && !minimal && dayEvents.length > maxVisible && (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpandedDays(prev => ({ ...prev, [dateStr]: false })); }}
              className="mt-1 px-2 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-500 text-[10px] font-bold text-left transition-colors h-6 flex items-center"
            >
              Show less
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCardInModal = (card: CardData) => {
    const commonProps = {
      card,
      isSelected: true,
      onSelect: () => {},
      onMove: () => {},
      onDelete: () => {},
      onUpdateContent: (id: string, content: any) => {
        onUpdateCard(selectedCard!.nodeId, selectedCard!.workspaceId, id, content);
        setSelectedCard(prev => prev ? { ...prev, card: { ...prev.card, content } } : null);
      },
      onResize: () => {},
      zoomScale: 1
    };

    switch (card.type) {
      case CardType.POST:
        return <PostCard {...commonProps} isLinked={false} />;
      case CardType.NEWSLETTER:
        return <NewsletterCard {...commonProps} />;
      case CardType.GANTT:
        return <GanttCard {...commonProps} />;
      case CardType.CALL_SHEET:
        return <CallSheetCard {...commonProps} />;
      default:
        return <div className="p-4 text-center text-gray-500">Preview not available for this card type.</div>;
    }
  };

  return (
    <div className="relative flex h-full bg-white">
      {/* Main calendar column — shrinks when the Unscheduled tray pushes in */}
      <div className="flex-1 min-w-0 flex flex-col">
      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6 order-2">
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col ${viewMode === 'quarter' ? 'bg-transparent border-none shadow-none' : ''}`}>
          {/* Days Header */}
          {(viewMode === 'month' || viewMode === 'week') && (
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-3 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className={`flex-1 ${viewMode === 'quarter' ? 'grid grid-cols-3 gap-4' : (viewMode === 'day' ? 'p-6' : `grid grid-cols-7 ${viewMode === 'month' ? 'grid-rows-5' : 'grid-rows-1'}`)}`}>
            {viewMode === 'quarter' ? (
              Array.from({ length: 3 }).map((_, mIndex) => {
                const qs = quarterStart(currentDate);
                const monthDate = new Date(qs.getFullYear(), qs.getMonth() + mIndex, 1);
                const mDaysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                const mFirstDay = monthDate.getDay();
                
                return (
                  <div key={mIndex} className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="py-2 text-center text-[13px] font-bold text-gray-900 border-b border-gray-100 bg-gray-50">
                      {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="grid grid-cols-7 border-b border-gray-50 bg-gray-50/30">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="py-1 text-center text-[10px] font-semibold text-gray-400">{d}</div>
                      ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 grid-rows-5">
                      {Array.from({ length: 35 }).map((_, i) => {
                        const dayNumber = i - mFirstDay + 1;
                        const isCurrentMonth = dayNumber > 0 && dayNumber <= mDaysInMonth;
                        const dateStr = isCurrentMonth ? toISODate(new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber)) : null;
                        const dayEvents = dateStr ? filteredCards.filter(p => toISODate(p.date) === dateStr) : [];
                        
                        return (
                          <div key={i} className={`border-r border-b border-gray-50 ${!isCurrentMonth ? 'bg-gray-50/30' : ''}`}>
                            {renderDayCell(new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber), isCurrentMonth, dateStr, dayEvents, true)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : viewMode === 'day' ? (
              <div className="max-w-2xl mx-auto w-full">
                <div className="mb-6 flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-sm ${toISODate(currentDate) === toISODate(new Date()) ? 'bg-[#FCCAE2] text-[#5F2427]' : 'bg-[#3A5C34] text-white'}`}>
                    <span className="text-[12px] font-medium opacity-80">{currentDate.toLocaleString('default', { weekday: 'short' })}</span>
                    <span className="text-2xl font-bold leading-none">{currentDate.getDate()}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <p className="text-[13px] text-gray-500">
                      {filteredCards.filter(p => toISODate(p.date) === toISODate(currentDate)).length} items scheduled
                    </p>
                  </div>
                </div>
                {/* Events for this day (full detail) */}
                {eventsOnDate(toISODate(currentDate)).length > 0 && (
                  <div className="mb-4 space-y-2">
                    {eventsOnDate(toISODate(currentDate)).map(ev => {
                      const cfg = getEventConfig(ev.category);
                      const bg = ev.color || cfg.color;
                      const Icon = cfg.Icon;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setEventModal({ event: ev })}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:shadow-md transition-shadow"
                          style={{ background: `${bg}1A` }}
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color: cfg.text }}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-gray-900 truncate flex items-center gap-1.5">
                              {ev.title}{ev.important && <Star size={12} className="fill-[#FFD753] text-[#FFD753]" />}
                            </p>
                            <p className="text-[12px] text-gray-500 truncate">
                              {cfg.label}
                              {ev.meta?.startTime ? ` • ${ev.meta.startTime}${ev.meta.endTime ? `–${ev.meta.endTime}` : ''}` : ''}
                              {ev.endDate && ev.endDate !== ev.startDate ? ` • ${ev.startDate} → ${ev.endDate}` : ''}
                              {ev.owner ? ` • ${ev.owner}` : ''}
                            </p>
                            {(ev.meta?.location || ev.meta?.offer || ev.meta?.promoCode || ev.meta?.budget || ev.meta?.goal || ev.meta?.deliverable || ev.meta?.channels?.length) && (
                              <p className="text-[12px] text-gray-500 truncate mt-0.5">
                                {[ev.meta.location, ev.meta.offer, ev.meta.promoCode && `Code: ${ev.meta.promoCode}`, ev.meta.budget, ev.meta.goal, ev.meta.deliverable, ev.meta.channels?.join(', ')].filter(Boolean).join(' • ')}
                              </p>
                            )}
                            {ev.meta?.url && <a href={ev.meta.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] text-[#007AFF] truncate block mt-0.5 hover:underline">{ev.meta.url}</a>}
                            {ev.description && <p className="text-[12px] text-gray-400 truncate mt-0.5" dir="auto">{ev.description}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {filteredCards.filter(p => toISODate(p.date) === toISODate(currentDate)).map(e => renderEvent(e))}
                  {filteredCards.filter(p => toISODate(p.date) === toISODate(currentDate)).length === 0 && eventsOnDate(toISODate(currentDate)).length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-[13px] border-2 border-dashed border-gray-100 rounded-xl">
                      Nothing scheduled for this day.
                    </div>
                  )}
                </div>
              </div>
            ) : viewMode === 'month' ? (
              Array.from({ length: 35 }).map((_, i) => {
                const dayNumber = i - firstDayOfMonth + 1;
                const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                const dateStr = isCurrentMonth ? toISODate(new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber)) : null;
                const dayEvents = dateStr ? filteredCards.filter(p => toISODate(p.date) === dateStr) : [];

                return (
                  <div key={i} className={`border-r border-b border-gray-100 ${!isCurrentMonth ? 'bg-gray-50/50' : ''}`}>
                    {renderDayCell(new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber), isCurrentMonth, dateStr, dayEvents)}
                  </div>
                );
              })
            ) : (
              getDaysInWeek().map((date, i) => {
                const dateStr = toISODate(date);
                const dayEvents = filteredCards.filter(p => toISODate(p.date) === dateStr);
                
                return (
                  <div key={i} className="border-r border-gray-100">
                    {renderDayCell(date, true, dateStr, dayEvents)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top controls — 3 zones: View · Nav(+Today) · Actions (Filter/Events/Unscheduled/Add) */}
      <div className="order-1 flex items-center justify-between gap-3 px-6 pt-6 pb-3">

        {/* LEFT — View toggle */}
        <div className="pointer-events-auto flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-10">
          {(['day', 'week', 'month', 'quarter'] as const).map((m, i) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-4 h-full text-[13px] font-medium capitalize transition-colors ${i < 3 ? 'border-r border-gray-100' : ''} ${viewMode === m ? 'bg-gray-50 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* CENTER — Navigation + Today */}
        <div className="pointer-events-auto flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-10">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 h-full text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100">Today</button>
          <button onClick={prevPeriod} className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-semibold w-32 text-center text-gray-700">
            {periodLabel()}
          </span>
          <button onClick={nextPeriod} className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><ChevronRight size={16} /></button>
        </div>

        {/* RIGHT — actions */}
        <div className="flex items-center gap-2.5">
          {/* Filter popover */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className={`pointer-events-auto h-10 px-3.5 flex items-center gap-2 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${showFilterMenu ? 'bg-gray-50 border-[#5F2427]/20' : 'bg-white text-gray-600 border-[#5F2427]/10 hover:bg-gray-50'}`}
            >
              <Filter size={15} />
              Filter
              {(selectedFolderId !== 'all' || selectedStatus !== 'all') && <span className="w-1.5 h-1.5 rounded-full bg-[#3A5C34]" />}
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setShowFilterMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-[100] w-56 bg-white rounded-2xl shadow-lg border border-gray-100 p-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Folder</label>
                    <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-gray-50 border border-gray-200 text-[13px] text-gray-700 focus:ring-0 outline-none cursor-pointer">
                      <option value="all">All Folders</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Status</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as any)} className="w-full h-9 px-2 rounded-lg bg-gray-50 border border-gray-200 text-[13px] text-gray-700 focus:ring-0 outline-none cursor-pointer">
                      <option value="all">All Statuses</option>
                      {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {(selectedFolderId !== 'all' || selectedStatus !== 'all') && (
                    <button onClick={() => { setSelectedFolderId('all'); setSelectedStatus('all'); }} className="w-full h-8 rounded-lg text-[12px] font-semibold text-gray-500 hover:bg-gray-50">Clear filters</button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Events show/hide toggle */}
          <button
            onClick={() => setShowEvents(v => !v)}
            title={showEvents ? 'Hide events' : 'Show events'}
            className={`pointer-events-auto h-10 px-3.5 flex items-center gap-2 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${showEvents ? 'bg-white text-gray-600 border-[#5F2427]/10 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 border-transparent'}`}
          >
            <Flag size={15} />
            Events
            {events.length > 0 && (
              <>
                <span className="self-stretch w-px bg-[#5F2427]/15" />
                <span className="text-[13px] font-bold tabular-nums text-[#5F2427]">{events.length}</span>
              </>
            )}
          </button>

          {/* Unscheduled tray toggle */}
          <button
            onClick={() => { setShowTray(v => !v); if (!showTray) setShowQueue(false); }}
            className={`pointer-events-auto h-10 px-3.5 flex items-center gap-2 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${showTray ? 'bg-[#3A5C34] text-white border-[#3A5C34]' : 'bg-white text-gray-600 border-[#5F2427]/10 hover:bg-gray-50'}`}
          >
            <LayoutGrid size={15} />
            Unscheduled
            {unscheduled.length > 0 && (
              <>
                <span className={`self-stretch w-px ${showTray ? 'bg-white/30' : 'bg-[#5F2427]/15'}`} />
                <span className={`text-[13px] font-bold tabular-nums ${showTray ? 'text-white' : 'text-[#5F2427]'}`}>{unscheduled.length}</span>
              </>
            )}
          </button>

          {/* Publish queue tray toggle */}
          <button
            onClick={() => { setShowQueue(v => !v); if (!showQueue) setShowTray(false); }}
            className={`pointer-events-auto h-10 px-3.5 flex items-center gap-2 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${showQueue ? 'bg-[#3A5C34] text-white border-[#3A5C34]' : 'bg-white text-gray-600 border-[#5F2427]/10 hover:bg-gray-50'}`}
          >
            <Send size={15} />
            Queue
            {publishQueue.filter(q => q.target.status === 'scheduled' || q.target.status === 'needs_action').length > 0 && (
              <>
                <span className={`self-stretch w-px ${showQueue ? 'bg-white/30' : 'bg-[#5F2427]/15'}`} />
                <span className={`text-[13px] font-bold tabular-nums ${showQueue ? 'text-white' : 'text-[#5F2427]'}`}>
                  {publishQueue.filter(q => q.target.status === 'scheduled' || q.target.status === 'needs_action').length}
                </span>
              </>
            )}
          </button>

          {/* Add event — primary CTA (burgundy bg + yellow text, on-brand) */}
          <button
            onClick={() => setEventModal({ defaultDate: toISODate(viewMode === 'day' ? currentDate : new Date()) })}
            className="pointer-events-auto h-10 px-4 flex items-center gap-2 rounded-xl shadow-sm bg-[#5F2427] hover:bg-[#4a1c1f] text-[#FFD753] text-[13px] font-bold transition-colors"
          >
            <Plus size={16} /> Add event
          </button>
        </div>
      </div>
      </div>{/* /main calendar column */}

      {/* Unscheduled tray — in-flow; pushes & shrinks the calendar so it stays 100% visible.
          Also the drop target for unscheduling: drag a dated post back here. */}
      <div
        className={`shrink-0 overflow-hidden bg-white border-l transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showTray ? 'w-72' : 'w-0'} ${overTray ? 'border-[#3A5C34] ring-2 ring-inset ring-[#3A5C34] bg-[#3A5C34]/5' : 'border-gray-200'}`}
        onDragOver={draggingDated ? (e) => { e.preventDefault(); setOverTray(true); } : undefined}
        onDragLeave={() => setOverTray(false)}
        onDrop={draggingDated ? (e) => { e.preventDefault(); if (dragItem) unschedule(dragItem); } : undefined}
      >
        <div className="w-72 h-full flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Unscheduled</h3>
            <p className="text-[12px] text-gray-400">
              {draggingDated ? 'Drop here to unschedule' : 'Drag a post onto a day to schedule it'}
            </p>
          </div>
          <button onClick={() => setShowTray(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {unscheduled.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-center">
              <CalendarIcon size={28} className="mb-2 opacity-20" />
              <p className="text-[13px] font-medium">Nothing unscheduled</p>
            </div>
          )}
          {unscheduled.map(p => (
            <div
              key={p.card.id}
              draggable
              onDragStart={(e) => { setDragItem({ card: p.card, nodeId: p.nodeId, workspaceId: p.workspaceId }); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDragItem(null); setDragOverDate(null); }}
              onClick={() => setSelectedCard({ card: p.card, nodeId: p.nodeId, workspaceId: p.workspaceId })}
              className="group flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-[#3A5C34]/30 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0">
                {getCardIcon(p.card.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{getCardTitle(p.card)}</p>
                <p className="text-[11px] text-gray-400 truncate">{getCardStatus(p.card)}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Publish queue tray — scheduled social publishes across every board */}
      <div className={`shrink-0 overflow-hidden bg-white border-l border-gray-200 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showQueue ? 'w-72' : 'w-0'}`}>
        <div className="w-72 h-full flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Publish queue</h3>
            <p className="text-[12px] text-gray-400">Scheduled posts across all boards</p>
          </div>
          <button onClick={() => setShowQueue(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {publishQueue.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-center px-4">
              <Send size={26} className="mb-2 opacity-20" />
              <p className="text-[13px] font-medium">Nothing scheduled</p>
              <p className="text-[11px] mt-1">Use the send button on a post or reel to schedule it</p>
            </div>
          )}
          {publishQueue.map(q => {
            const when = new Date(q.target.at);
            const overdue = q.target.status === 'needs_action';
            const done = q.target.status === 'published';
            return (
              <button
                key={q.target.id}
                onClick={() => onNavigate(q.nodeId)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${overdue ? 'border-[#FFD753] bg-[#FFD753]/10' : 'border-gray-100 bg-white hover:border-[#3A5C34]/30 hover:shadow-sm'} ${done ? 'opacity-55' : ''}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-[#5F2427] text-[#FCCAE2]' : 'bg-[#3A5C34]/10 text-[#3A5C34]'}`}>
                  {getCardIcon(q.card.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-semibold text-gray-800 truncate ${done ? 'line-through' : ''}`} dir="auto">{getCardTitle(q.card)}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {PLATFORM_META[q.target.platform].label} · {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {overdue && <span className="text-[#5F2427] font-bold"> · ready!</span>}
                    {done && ' · published'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Add / edit a calendar event */}
      {eventModal && (
        <EventModal
          event={eventModal.event}
          defaultDate={eventModal.defaultDate}
          onSubmit={(data) => {
            if (eventModal.event) onUpdateEvent(eventModal.event.id, data);
            else onAddEvent(data);
            setEventModal(null);
          }}
          onDelete={eventModal.event ? () => { onDeleteEvent(eventModal.event!.id); setEventModal(null); } : undefined}
          onClose={() => setEventModal(null)}
        />
      )}

      {/* Day click → schedule an unscheduled item onto this date, or create an event. */}
      {dayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-8" onClick={() => setDayModal(null)}>
          <div className="relative w-full max-w-[420px] max-h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#3A5C34]">Schedule for</div>
                <div className="text-[16px] font-bold text-gray-900">
                  {new Date(dayModal + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <button onClick={() => setDayModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
              {unscheduled.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <p className="text-[13px] font-medium">Nothing unscheduled</p>
                  <p className="text-[12px]">Create an event below</p>
                </div>
              ) : unscheduled.map(item => (
                <button
                  key={item.card.id}
                  onClick={() => { assignToDate(item, dayModal); setDayModal(null); soundService.play('snap'); }}
                  className="w-full p-3 rounded-xl border border-gray-100 bg-white hover:border-[#3A5C34] hover:bg-[#FCCAE2]/10 transition-all flex items-center gap-3 text-left mb-2"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0">
                    {getCardIcon(item.card.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">{(item.card.content as any)?.title || 'Untitled'}</div>
                    <div className="text-[11px] text-gray-400">{String(item.card.type).toLowerCase()}</div>
                  </div>
                  <Plus size={15} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => { const d = dayModal; setDayModal(null); setEventModal({ defaultDate: d }); }}
                className="w-full h-10 rounded-xl bg-[#3A5C34] text-white text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#2d4a29] transition-colors"
              >
                <Plus size={16} /> New event on this day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST → Instagram preview mockup (same as whiteboard). Others → editor modal. */}
      {selectedCard && selectedCard.card.type === CardType.POST && (
        <InstagramPreviewModal post={selectedCard.card} onClose={() => setSelectedCard(null)} />
      )}
      {selectedCard && selectedCard.card.type === CardType.STORY && (
        <StoryPreviewModal story={selectedCard.card} onClose={() => setSelectedCard(null)} />
      )}
      {selectedCard && selectedCard.card.type === CardType.REELS && (
        <ReelsPreviewModal reel={selectedCard.card} onClose={() => setSelectedCard(null)} />
      )}
      {selectedCard && ![CardType.POST, CardType.STORY, CardType.REELS].includes(selectedCard.card.type) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-8" onClick={() => setSelectedCard(null)}>
          <div className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setSelectedCard(null)} className="p-2 bg-white/80 backdrop-blur rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="transform scale-100 origin-top">
                {renderCardInModal(selectedCard.card)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
