import React, { useMemo, useState, useEffect, useRef } from 'react';
import { FileSystemNode, CardData, CardType, MediaItem, PostCardContent, ReelsCardContent, FeedCadence, CalendarEvent, MockupProfile, FeedDraft } from '../types';
import { toISODate, parseISODate } from '../services/dateUtils';
import { findLinkedGrid, getSlotDate, resolveDateWrites } from '../services/gridPlanner';
import { soundService } from '../services/soundService';
import {
  FeedChannel, FeedItem, collectFeedItems, buildFeedMonth, unplacedItems, orderedFeedItems,
  feedMonthKey, resolveMonthCadence, FeedCadenceMap, itemDate,
  collectStoryItems, storyDayGroups, monthDays, dayStoryFrames,
} from '../services/feedPlanner';
import {
  feedDraftsFor, draftDateResolver, createDraftFromArrangement,
  writeDraftDate, setDraftCadence, finalizePlan,
} from '../services/feedDrafts';
import { getEventConfig } from './modals/EventModal';
import { InstagramPreviewModal } from './modals/InstagramPreviewModal';
import { ReelsPreviewModal } from './modals/ReelsPreviewModal';
import { StoryPreviewModal } from './modals/StoryPreviewModal';
import { EventDetailsModal } from './modals/EventDetailsModal';
import { SlotPickerModal } from './modals/SlotPickerModal';
import { FeedProfilePreview } from './FeedProfilePreview';
import { StoriesLane } from './StoriesLane';
import { resolveMockupProfile } from '../services/mockupProfile';
import { computeFeedGrid } from '../services/feedGrid';
import { PostCard } from './cards/PostCard';
import { ReelsCard } from './cards/ReelsCard';
import { StoryCard } from './cards/StoryCard';
import {
  Instagram, Music2, ChevronLeft, ChevronRight, LayoutGrid, Video, FileImage, Plus, Minus, X, Play, Pencil, CalendarOff,
  Layers, Check, Trash2, ChevronDown, FilePlus, CheckCircle2, Radio,
} from 'lucide-react';
import { VideoThumb } from './media/VideoThumb';

interface FeedPlannerViewProps {
  nodes: Record<string, FileSystemNode>;
  onNavigate: (id: string) => void;
  onUpdateCard: (nodeId: string, workspaceId: string, cardId: string, content: any) => void;
  events: CalendarEvent[];
  brandName?: string;
  avatarUrl?: string;
  /** Editable per-channel social profiles for the phone mockup (per brand). */
  brandProfiles?: { [channel: string]: MockupProfile };
  onUpdateBrandProfile?: (channel: string, patch: Partial<MockupProfile>) => void;
  /** Cadence remembered per (channel, month) on the brand. */
  brandFeedCadence?: FeedCadenceMap;
  onUpdateFeedCadence?: (channel: string, monthKey: string, cadence: FeedCadence) => void;
  /** Saved monthly plans (drafts) on the brand + their CRUD. */
  brandDrafts?: FeedDraft[];
  onAddDraft?: (draft: FeedDraft) => void;
  onUpdateDraft?: (draftId: string, patch: Partial<FeedDraft>) => void;
  onRemoveDraft?: (draftId: string) => void;
}

const CHANNELS: { id: FeedChannel; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'tiktok', label: 'TikTok', Icon: Music2 },
];

const previewMedia = (card: CardData): MediaItem | null => {
  if (card.type === CardType.REELS) return (card.content as ReelsCardContent).cover || null;
  const pc = card.content as PostCardContent;
  return pc.finalAssets?.[0] || pc.references?.[0] || null;
};
const cardTitle = (card: CardData): string => (card.content as any)?.title || (card.type === CardType.REELS ? 'Untitled Reel' : 'Untitled Post');
const itemHasDate = (card: CardData) => !!(card.content as any)?.date;

const GAP = 8; // slot gutter, shared by the layout maths in services/feedGrid

function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // True while the box is actively being resized. Slot size is animated, but an
  // animation can't keep up with a window drag — it would lag behind the cursor —
  // so transitions are switched off until the resize settles.
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout>;
    let first = true;
    // Measure once, synchronously. ResizeObserver only reports on its own
    // schedule, so without this the grid renders one frame at zero size.
    const r0 = el.getBoundingClientRect();
    if (r0.width > 0 && r0.height > 0) setSize({ w: r0.width, h: r0.height });
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
      if (first) { first = false; return; } // initial measure isn't a "resize"
      setResizing(true);
      clearTimeout(settle);
      settle = setTimeout(() => setResizing(false), 120);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(settle); };
  }, []);
  return [ref, size, resizing] as const;
}

export const FeedPlannerView: React.FC<FeedPlannerViewProps> = ({ nodes, onUpdateCard, events, brandName = 'Your brand', avatarUrl, brandProfiles, onUpdateBrandProfile, brandFeedCadence, onUpdateFeedCadence, brandDrafts, onAddDraft, onUpdateDraft, onRemoveDraft }) => {
  const [channel, setChannel] = useState<FeedChannel>('instagram');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSources, setShowSources] = useState(false);
  const [dragItem, setDragItem] = useState<FeedItem | null>(null);
  const [dragOriginISO, setDragOriginISO] = useState<string | undefined>(undefined);
  const [dropTargetISO, setDropTargetISO] = useState<string | null>(null);
  // Hovering the Unscheduled drawer while dragging a scheduled item = unschedule.
  const [overTray, setOverTray] = useState(false);
  const [preview, setPreview] = useState<CardData | null>(null);
  // A synthetic story card (one day's frames) shown in the story viewer.
  const [storyPreview, setStoryPreview] = useState<CardData | null>(null);
  // Editing a card's real editor in fullscreen, straight from the Feed page.
  const [editing, setEditing] = useState<FeedItem | null>(null);
  // Clicking an event marker → read-only details; clicking an empty slot → picker.
  const [eventDay, setEventDay] = useState<string | null>(null);
  const [slotPicker, setSlotPicker] = useState<{ iso: string; kind: 'feed' | 'story' } | null>(null);
  // Day→day story drag (swap dates), like the grid's post swap.
  const [storyDragFromISO, setStoryDragFromISO] = useState<string | null>(null);
  // Drafts (saved monthly plans). null = Live (the real schedule). A loaded
  // draft renders/edits an OVERLAY without touching the posts until "Set as final".
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftsMenu, setDraftsMenu] = useState(false);
  const [renamingDraftId, setRenamingDraftId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const todayISO = toISODate(new Date());

  // One resolved identity for this channel, shared by the phone mockup AND the
  // preview modals — so an opened post shows the same handle/picture as the
  // profile above it. Blank fields fall back to the brand.
  const mockupProfile = useMemo(
    () => resolveMockupProfile(brandProfiles?.[channel], { brandName, avatarUrl }),
    [brandProfiles, channel, brandName, avatarUrl],
  );

  // Scope = a board (whiteboard) or 'all'. Folders aren't necessarily brands.
  // (Only a display filter for which posts show — cadence is brand-level, below.)
  const boards = useMemo(() => Object.values(nodes).filter(n => n?.type === 'whiteboard'), [nodes]);
  const [scopeId, setScopeId] = useState<string>('all');

  const monthKey = feedMonthKey(year, month);

  // A draft belongs to a specific (channel, month) — leaving either drops back
  // to Live so you can never edit a draft that doesn't match the view.
  useEffect(() => { setActiveDraftId(null); }, [channel, monthKey]);

  const monthDrafts = useMemo(() => feedDraftsFor(brandDrafts, channel, monthKey), [brandDrafts, channel, monthKey]);
  const activeDraft = useMemo(() => monthDrafts.find(d => d.id === activeDraftId) || null, [monthDrafts, activeDraftId]);
  // In a draft the date comes from its overlay, not the post's live content.date.
  const getDate = useMemo(() => (activeDraft ? draftDateResolver(activeDraft) : itemDate), [activeDraft]);
  // Drafts are inherently cross-board (a channel's whole month), so editing one
  // forces "All boards"; the board filter only applies to Live.
  const effectiveScope = activeDraft ? 'all' : scopeId;

  // Cadence: a draft carries its own; Live reads the brand's per-(channel,month)
  // value (auto-saved, no Save button). Both write through the same setters.
  const cadence = useMemo(
    () => (activeDraft ? activeDraft.cadence : resolveMonthCadence(brandFeedCadence, channel, monthKey)),
    [activeDraft, brandFeedCadence, channel, monthKey],
  );
  const setCadence = (next: FeedCadence) => {
    if (activeDraft) onUpdateDraft?.(activeDraft.id, { cadence: setDraftCadence(activeDraft, next).cadence, updatedAt: new Date().toISOString() });
    else onUpdateFeedCadence?.(channel, monthKey, next);
  };
  const bumpCadence = (delta: number) => {
    const max = cadence.mode === 'perWeek' ? 14 : 31;
    setCadence({ ...cadence, value: Math.max(1, Math.min(max, cadence.value + delta)) });
  };
  const setMode = (mode: FeedCadence['mode']) => {
    if (mode === cadence.mode) return;
    setCadence({ mode, value: 3 });
  };

  const items = useMemo(() => collectFeedItems(nodes, effectiveScope, channel), [nodes, effectiveScope, channel]);
  // One anchor slot per event whose start date falls in the shown month
  // (single-day events → that day; multi-day → its start), guaranteed a slot.
  const eventAnchorDates = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      const d = parseISODate(ev.startDate);
      if (d.getMonth() === month && d.getFullYear() === year) set.add(ev.startDate);
    }
    return [...set];
  }, [events, month, year]);
  const cells = useMemo(() => buildFeedMonth(items, cadence, month, year, eventAnchorDates, getDate), [items, cadence, month, year, eventAnchorDates, getDate]);
  const feedItems = useMemo(() => orderedFeedItems(items, getDate), [items, getDate]);

  // Stories — Instagram-only, a per-day circle lane below the grid (never in the
  // grid). They ride the same date machinery (getDate/place/finalize) as posts.
  const showStories = channel === 'instagram';
  const storyItems = useMemo(
    () => (showStories ? collectStoryItems(nodes, effectiveScope) : []),
    [showStories, nodes, effectiveScope],
  );
  const storyGroups = useMemo(() => storyDayGroups(storyItems, month, year, getDate), [storyItems, month, year, getDate]);
  const storyDayList = useMemo(() => monthDays(month, year), [month, year]);
  // Undated stories join the Unscheduled tray so they can be dragged onto a day.
  const sources = useMemo(
    () => unplacedItems(showStories ? [...items, ...storyItems] : items, getDate),
    [items, storyItems, showStories, getDate],
  );

  // Split sources by kind so the empty-slot picker offers the relevant items.
  const feedSources = useMemo(() => sources.filter(i => i.card.type !== CardType.STORY), [sources]);
  const storySources = useMemo(() => sources.filter(i => i.card.type === CardType.STORY), [sources]);

  // Days in the visible month that carry a calendar event → a clickable flag.
  const eventDaysSet = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) {
      const start = parseISODate(ev.startDate);
      const end = ev.endDate && ev.endDate >= ev.startDate ? parseISODate(ev.endDate) : start;
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) s.add(toISODate(d));
      }
    }
    return s;
  }, [events, month, year]);

  // Calendar events that cover a given date (multi-day aware).
  const eventsOnDate = (iso: string): CalendarEvent[] =>
    events
      .filter(ev => {
        const end = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
        return ev.startDate <= iso && iso <= end;
      })
      .sort((a, b) => (Number(!!b.important) - Number(!!a.important)) || a.startDate.localeCompare(b.startDate));

  const [gridRef, gridSize, resizing] = useContainerSize<HTMLDivElement>();
  const { cols, cellW, cellH, scroll } = useMemo(
    () => computeFeedGrid(gridSize.w, gridSize.h, cells.length, GAP),
    [gridSize.w, gridSize.h, cells.length],
  );
  const showEventLabels = cellW >= 96;

  // Write a post/reel's date via the same path as the calendar (linked planner
  // reschedules its slot, else content.date). dateStr=undefined → unscheduled.
  const assignToDate = (item: FeedItem, dateStr: string | undefined) => {
    const { card, nodeId, workspaceId } = item;
    const wsCards = nodes[nodeId]?.whiteboardData?.find(w => w.id === workspaceId)?.cards || [];
    // Shared with the Calendar (services/gridPlanner) — scheduling moves the
    // linked planner slot, unscheduling releases it.
    resolveDateWrites(wsCards, card, dateStr, ensureChannel(card, channel, dateStr))
      .forEach(w => onUpdateCard(nodeId, workspaceId, w.cardId, w.content));
  };

  // In a draft, date changes edit the draft's OVERLAY (never the posts); in Live
  // they go through assignToDate. A swap is two updates against ONE draft copy —
  // applying them one-by-one would let the second overwrite the first (stale
  // closure over a not-yet-rerendered draft).
  const placeMany = (updates: { item: FeedItem; date: string | undefined }[]) => {
    if (activeDraft) {
      const dates = { ...activeDraft.dates };
      for (const u of updates) { if (u.date) dates[u.item.card.id] = u.date; else delete dates[u.item.card.id]; }
      onUpdateDraft?.(activeDraft.id, { dates, updatedAt: new Date().toISOString() });
    } else {
      updates.forEach(u => assignToDate(u.item, u.date));
    }
  };
  const place = (item: FeedItem, date: string | undefined) => placeMany([{ item, date }]);

  /** Drag out of the grid (or click the tile's Unschedule button) → back to Unscheduled. */
  const unschedule = (item: FeedItem) => {
    if (!getDate(item.card)) return;
    place(item, undefined);
    soundService.play('snap');
  };

  // Reorder inside the mockup = swap two placed posts' dates (the grid is sorted
  // by date, so swapping dates swaps positions). Uses the current getDate so it
  // works identically on Live and inside a draft.
  const handleMockupReorder = (dragged: FeedItem, target: FeedItem) => {
    if (dragged.card.id === target.card.id) return;
    const dragDate = getDate(dragged.card);
    const targetDate = getDate(target.card);
    if (!dragDate || !targetDate) return;
    placeMany([{ item: dragged, date: targetDate }, { item: target, date: dragDate }]);
  };

  const beginDrag = (item: FeedItem, originISO?: string) => {
    setDragItem(item);
    setDragOriginISO(originISO);
    // Dragging a scheduled item out needs a visible target to drop onto.
    if (originISO) setShowSources(true);
  };
  const endDrag = () => { setDragItem(null); setDragOriginISO(undefined); setDropTargetISO(null); setOverTray(false); };

  const handleDropOnCell = (targetDateISO: string, targetItem?: FeedItem) => {
    if (!dragItem) return;
    // Stories never enter the rectangular grid — they schedule via the lane only.
    if (dragItem.card.type === CardType.STORY) { endDrag(); return; }
    if (targetItem && targetItem.card.id === dragItem.card.id) { endDrag(); return; }
    const updates: { item: FeedItem; date: string | undefined }[] = [{ item: dragItem, date: targetDateISO }];
    // Swap ONLY when reordering two dated posts within the grid (the drag has an
    // origin date). A drag from Unscheduled just STACKS onto the day — several
    // posts can share one date for an ad-hoc heavier day, without touching cadence.
    if (targetItem && dragOriginISO) updates.push({ item: targetItem, date: dragOriginISO });
    placeMany(updates);
    endDrag();
  };

  // --- Story lane -----------------------------------------------------------
  // The lane is a live drop target when a story is dragged from the tray OR when
  // a filled day is being dragged to another day (swap).
  const storyDragActive = (!!dragItem && dragItem.card.type === CardType.STORY) || storyDragFromISO !== null;
  const dropStoryOnDay = (iso: string) => {
    // Day → day: swap every story of the source day with the target day's.
    if (storyDragFromISO !== null) {
      if (storyDragFromISO !== iso) {
        const from = storyGroups.find(g => g.iso === storyDragFromISO)?.items || [];
        const to = storyGroups.find(g => g.iso === iso)?.items || [];
        placeMany([
          ...from.map(it => ({ item: it, date: iso })),
          ...to.map(it => ({ item: it, date: storyDragFromISO })),
        ]);
      }
      setStoryDragFromISO(null);
      setDropTargetISO(null);
      return;
    }
    // Tray → day: schedule the dragged story onto that day.
    if (!dragItem || dragItem.card.type !== CardType.STORY) return;
    place(dragItem, iso); // Live → post.content.date; draft → overlay
    endDrag();
  };
  // Tap a day → play ONLY that day's stories (a synthetic card of its frames).
  const openStoryDay = (iso: string) => {
    const group = storyGroups.find(g => g.iso === iso);
    if (!group) return;
    setStoryPreview({
      id: `story-day-${iso}`, type: CardType.STORY, x: 0, y: 0, width: 240, height: 400, zIndex: 1,
      content: { frames: dayStoryFrames(group.items) } as any,
    });
  };
  const editStoryDay = (iso: string) => {
    const group = storyGroups.find(g => g.iso === iso);
    if (group?.items[0]) setEditing(group.items[0]);
  };

  // --- Draft actions -------------------------------------------------------
  // Snapshot the currently-shown arrangement into a new draft (from Live = copy
  // the live schedule; from a draft = duplicate it), then edit that draft.
  const saveCurrentAsDraft = () => {
    if (!onAddDraft) return;
    const draft = createDraftFromArrangement(items, getDate, month, year, {
      channel, monthKey, cadence, name: `Draft ${monthDrafts.length + 1}`,
    });
    onAddDraft(draft);
    setActiveDraftId(draft.id);
    setDraftsMenu(false);
    soundService.play('snap');
  };
  const loadDraft = (id: string | null) => { setActiveDraftId(id); setDraftsMenu(false); };
  const startRename = (d: FeedDraft) => { setRenamingDraftId(d.id); setRenameValue(d.name); };
  const commitRename = () => {
    if (renamingDraftId) {
      const name = renameValue.trim();
      if (name) onUpdateDraft?.(renamingDraftId, { name, updatedAt: new Date().toISOString() });
    }
    setRenamingDraftId(null);
  };
  const deleteDraft = (id: string) => {
    onRemoveDraft?.(id);
    if (activeDraftId === id) setActiveDraftId(null);
  };
  // What "Set as final" would do (writes + clears), computed live for the confirm.
  // Stories are dated items too, so they commit/clear with the draft.
  const finalize = useMemo(
    () => (activeDraft ? finalizePlan([...items, ...storyItems], activeDraft, month, year) : null),
    [activeDraft, items, storyItems, month, year],
  );
  // Commit the draft onto the real posts via the LIVE path (assignToDate →
  // resolveDateWrites → calendar sync), then drop back to Live now equal to it.
  const applyFinalize = () => {
    if (!activeDraft || !finalize) return;
    finalize.writes.forEach(w => assignToDate(w.item, w.date));
    finalize.clears.forEach(c => assignToDate(c, undefined));
    setFinalizing(false);
    setActiveDraftId(null);
    soundService.play('snap');
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const cadenceLabel = cadence.mode === 'perWeek' ? `${cadence.value} / week` : `every ${cadence.value} days`;

  const toggleSources = () => setShowSources(v => !v);

  const renderEventStrip = (iso: string) => {
    const evs = eventsOnDate(iso);
    if (evs.length === 0) return null;
    const open = (e: React.MouseEvent) => { e.stopPropagation(); setEventDay(iso); };
    return (
      <div className="absolute top-0 left-0 right-0 z-10 p-1">
        {showEventLabels ? (
          <div className="flex flex-col gap-0.5">
            {evs.slice(0, 2).map(ev => {
              const cfg = getEventConfig(ev.category);
              return (
                <button key={ev.id} onClick={open} title={ev.title} className="flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-bold leading-none shadow-sm hover:brightness-95 transition" style={{ background: ev.color || cfg.color, color: cfg.text }}>
                  <cfg.Icon size={8} /><span className="truncate">{ev.title}</span>
                </button>
              );
            })}
            {evs.length > 2 && <button onClick={open} className="text-[8px] font-bold text-gray-600 bg-white/80 rounded px-1 self-start hover:bg-white">+{evs.length - 2}</button>}
          </div>
        ) : (
          <button onClick={open} title={evs.map(e => e.title).join(', ')} className="flex gap-0.5 flex-wrap">
            {evs.slice(0, 4).map(ev => {
              const cfg = getEventConfig(ev.category);
              return <span key={ev.id} className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ background: ev.color || cfg.color }} />;
            })}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-full bg-white">
      {/* Main column — shrinks when a right panel pushes in */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top controls — 3 zones (mirrors CalendarView) */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">

          {/* LEFT — channel toggle + board scope */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-10">
              {CHANNELS.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className={`px-4 h-full text-[13px] font-medium flex items-center gap-1.5 transition-colors ${i < CHANNELS.length - 1 ? 'border-r border-gray-100' : ''} ${channel === c.id ? 'bg-gray-50 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <c.Icon size={15} /> {c.label}
                </button>
              ))}
            </div>
            <select
              value={effectiveScope}
              onChange={e => setScopeId(e.target.value)}
              disabled={!!activeDraft}
              title={activeDraft ? 'A draft plans the whole channel across all boards' : undefined}
              className="h-10 px-3 rounded-xl bg-white shadow-sm border border-[#5F2427]/10 text-[13px] font-medium text-gray-700 focus:ring-0 outline-none cursor-pointer hover:bg-gray-50 max-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All boards</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            {/* Drafts selector — Live vs saved monthly plans for this (channel, month). */}
            <div className="relative">
              <button
                onClick={() => setDraftsMenu(v => !v)}
                className={`h-10 px-3 flex items-center gap-1.5 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${activeDraft ? 'bg-[#5F2427] text-[#F9E6D1] border-[#5F2427]' : 'bg-white text-gray-700 border-[#5F2427]/10 hover:bg-gray-50'}`}
              >
                <Layers size={15} />
                <span className="max-w-[120px] truncate">{activeDraft ? activeDraft.name : 'Live'}</span>
                <ChevronDown size={13} className={`transition-transform ${draftsMenu ? 'rotate-180' : ''}`} />
              </button>
              {draftsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDraftsMenu(false)} />
                  <div className="absolute left-0 top-11 z-50 w-64 bg-white rounded-xl shadow-lg border border-[#5F2427]/10 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={() => loadDraft(null)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Radio size={14} className="text-[#3A5C34]" />
                      <span className="flex-1 text-left">Live (current schedule)</span>
                      {!activeDraft && <Check size={15} className="text-[#3A5C34]" />}
                    </button>
                    {monthDrafts.length > 0 && <div className="my-1 h-px bg-gray-100" />}
                    {monthDrafts.map(d => (
                      <div key={d.id} className="group flex items-center gap-1 pr-1 rounded-lg hover:bg-gray-50">
                        {renamingDraftId === d.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingDraftId(null); }}
                            className="flex-1 min-w-0 px-2.5 py-2 text-[13px] font-medium bg-white border border-[#3A5C34]/40 rounded-lg outline-none"
                          />
                        ) : (
                          <button onClick={() => loadDraft(d.id)} className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium text-gray-700 text-left">
                            <Layers size={13} className="text-gray-400 shrink-0" />
                            <span className="flex-1 truncate">{d.name}</span>
                            {activeDraftId === d.id && <Check size={15} className="text-[#3A5C34] shrink-0" />}
                          </button>
                        )}
                        <button aria-label="Rename" onClick={() => startRename(d)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700"><Pencil size={12} /></button>
                        <button aria-label="Delete" onClick={() => deleteDraft(d.id)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <div className="my-1 h-px bg-gray-100" />
                    <button
                      onClick={saveCurrentAsDraft}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#3A5C34] hover:bg-[#3A5C34]/5"
                    >
                      <FilePlus size={14} />
                      Save current view as draft
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CENTER — month navigation (no Today; not every day has a post) */}
          <div className="flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-10">
            <button onClick={prevMonth} className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors border-r border-gray-100"><ChevronLeft size={16} /></button>
            <span className="text-[13px] font-semibold w-32 text-center text-gray-700">{monthLabel}</span>
            <button onClick={nextMonth} className="w-9 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors border-l border-gray-100"><ChevronRight size={16} /></button>
          </div>

          {/* RIGHT — cadence + panels */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-10">
              <button onClick={() => setMode('perWeek')} className={`px-2.5 h-full text-[12px] font-medium border-r border-gray-100 transition-colors ${cadence.mode === 'perWeek' ? 'bg-gray-50 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>/week</button>
              <button onClick={() => setMode('everyNDays')} className={`px-2.5 h-full text-[12px] font-medium border-r border-gray-100 transition-colors ${cadence.mode === 'everyNDays' ? 'bg-gray-50 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>/N days</button>
              <button onClick={() => bumpCadence(-1)} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50"><Minus size={13} /></button>
              <span className="text-[12px] font-bold text-gray-700 tabular-nums w-24 text-center">{cadenceLabel}</span>
              <button onClick={() => bumpCadence(1)} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 border-l border-gray-100"><Plus size={13} /></button>
            </div>

            <button
              onClick={toggleSources}
              className={`h-10 px-3.5 flex items-center gap-2 rounded-xl shadow-sm border text-[13px] font-medium transition-colors ${showSources ? 'bg-[#3A5C34] text-white border-[#3A5C34]' : 'bg-white text-gray-600 border-[#5F2427]/10 hover:bg-gray-50'}`}
            >
              <LayoutGrid size={15} />
              Unscheduled
              {sources.length > 0 && (
                <>
                  <span className={`self-stretch w-px ${showSources ? 'bg-white/30' : 'bg-[#5F2427]/15'}`} />
                  <span className={`text-[13px] font-bold tabular-nums ${showSources ? 'text-white' : 'text-[#5F2427]'}`}>{sources.length}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Draft banner — a loud reminder you are NOT editing the live schedule. */}
        {activeDraft && (
          <div className="mx-6 mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#5F2427] text-[#F9E6D1] animate-in fade-in slide-in-from-top-1 duration-200">
            <Layers size={16} className="shrink-0" />
            <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
              <span className="text-[13px] font-semibold">
                Editing draft ·{' '}
                {renamingDraftId === activeDraft.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingDraftId(null); }}
                    className="px-1.5 py-0.5 text-[13px] font-bold bg-white/15 border border-white/30 rounded outline-none text-white w-40"
                  />
                ) : (
                  <span onDoubleClick={() => startRename(activeDraft)} title="Double-click to rename" className="font-bold cursor-text">{activeDraft.name}</span>
                )}
              </span>
              <span className="text-[11px] opacity-70">Changes stay in this draft until you set it final</span>
            </div>
            <button
              onClick={() => setFinalizing(true)}
              className="shrink-0 h-8 px-3 flex items-center gap-1.5 rounded-lg bg-[#FFD753] text-[#5F2427] text-[12px] font-bold hover:brightness-105 transition-all"
            >
              <CheckCircle2 size={14} /> Set as final
            </button>
            <button
              onClick={() => loadDraft(null)}
              className="shrink-0 h-8 px-3 flex items-center rounded-lg text-[12px] font-semibold text-[#F9E6D1]/90 hover:bg-white/10 transition-colors"
            >
              Exit to live
            </button>
          </div>
        )}

        {/* Content — the slot grid and the live feed preview sit side by side as
            two sibling cards in the same surface language (see SettingsModal). */}
        <div className="flex-1 min-h-0 px-6 pb-6 flex gap-4">
          <div className="flex-1 min-w-0 h-full flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0 bg-white overflow-hidden">
            <div ref={gridRef} className={`h-full no-scrollbar ${scroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
              {cells.length === 0 ? (
                <div className="min-h-full flex flex-col items-center justify-center text-gray-400 text-center">
                  <LayoutGrid size={30} className="mb-3 opacity-20" />
                  <p className="text-[13px] font-semibold text-gray-500">Nothing this month</p>
                  <p className="text-[12px]">Drag posts from “Unscheduled”, or raise the cadence</p>
                </div>
              ) : (
                <div
                  key={`${year}-${month}`}
                  className="min-h-full"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
                    // Size the ROWS, not the items: the track is what has to add
                    // up to the container height for the grid to fill it.
                    gridAutoRows: `${cellH}px`,
                    gap: `${GAP}px`,
                    justifyContent: 'center',
                    alignContent: 'center',
                  }}
                >
                    {cells.map((cell, i) => {
                      const iso = toISODate(cell.date);
                      const media = cell.item ? previewMedia(cell.item.card) : null;
                      // A story drag targets the lane, not the grid — don't light grid cells for it.
                      const isDropTarget = dropTargetISO === iso && !!dragItem && dragItem.card.type !== CardType.STORY;
                      const isDragSource = !!cell.item && dragItem?.card.id === cell.item.card.id;
                      const isToday = iso === todayISO;
                      // Every decoration is INSET (or a border, which is inside the
                      // box model): an outside ring / scale would clip at the
                      // container edge and eat into the gap between slots.
                      const base = cell.ghost
                        ? (cell.event
                            ? 'border-2 border-dashed border-[#5F2427]/40 bg-[#FCCAE2]/15 hover:border-[#5F2427] cursor-pointer'
                            : isToday
                              // Today: soft brand-pink single line, not a ring over a border.
                              ? 'border-2 border-dashed border-[#F0A6C9] bg-[#FCCAE2]/25 hover:border-[#e58bb8] cursor-pointer'
                              : 'border-2 border-dashed border-[#5F2427]/15 bg-white hover:border-[#3A5C34] hover:bg-[#FCCAE2]/10 cursor-pointer')
                        : `bg-white shadow-sm ring-1 ring-inset ${isToday
                            ? 'ring-[2.5px] ring-[#F0A6C9]'
                            : 'ring-[#5F2427]/[0.08] hover:ring-2 hover:ring-[#3A5C34]'} cursor-grab active:cursor-grabbing`;
                      const slotClass = isDropTarget
                        ? 'ring-2 ring-inset ring-[#3A5C34] bg-[#3A5C34]/5'
                        : base;
                      return (
                        <div
                          key={cell.item?.card.id || `ghost-${iso}-${i}`}
                          style={{
                            // minHeight (not height): the row still resolves to
                            // exactly cellH via grid stretch, but a slot can grow
                            // instead of clipping if its content ever needs to.
                            minHeight: cellH,
                            // Month-change entrance: a short, capped stagger.
                            animationDelay: `${Math.min(i * 12, 180)}ms`,
                          }}
                          draggable={!!cell.item}
                          onDragStart={cell.item ? () => beginDrag(cell.item!, iso) : undefined}
                          onDragEnd={endDrag}
                          onDragOver={dragItem ? (e) => { e.preventDefault(); setDropTargetISO(iso); } : undefined}
                          onDragLeave={() => setDropTargetISO(prev => (prev === iso ? null : prev))}
                          onDrop={dragItem ? (e) => { e.preventDefault(); handleDropOnCell(iso, cell.item); } : undefined}
                          onClick={() => cell.item ? setPreview(cell.item.card) : setSlotPicker({ iso, kind: 'feed' })}
                          className={`relative rounded-xl overflow-hidden group animate-in fade-in slide-in-from-bottom-1 duration-150 ${resizing ? 'transition-none' : 'transition-all duration-200'} ${isDragSource ? 'opacity-40' : ''} ${slotClass}`}
                        >
                          {renderEventStrip(iso)}
                          {cell.item ? (
                            <>
                              {media?.type === 'image' && <img src={media.url} className="w-full h-full object-cover pointer-events-none" />}
                              {media?.type === 'video' && <VideoThumb url={media.url} thumbnail={media.thumbnail} className="w-full h-full object-cover pointer-events-none" />}
                              {!media && <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">{cell.item.card.type === CardType.REELS ? <Video size={18} /> : <FileImage size={18} />}</div>}
                              {cell.item.card.type === CardType.REELS && <span className="absolute bottom-1 right-1 text-white drop-shadow pointer-events-none"><Play size={12} className="fill-white" /></span>}
                              <span
                                role="button"
                                aria-label="Edit"
                                onClick={(e) => { e.stopPropagation(); setEditing(cell.item!); }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65 z-10"
                              >
                                <Pencil size={12} />
                              </span>
                              {/* Unschedule — deliberately NOT an "X", which reads as delete. */}
                              {cellW >= 80 && (
                                <span
                                  role="button"
                                  aria-label="Unschedule"
                                  title="Unschedule — send back to Unscheduled"
                                  onClick={(e) => { e.stopPropagation(); unschedule(cell.item!); }}
                                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65 z-10"
                                >
                                  <CalendarOff size={12} />
                                </span>
                              )}
                              {cellW >= 80 && (
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/55 text-white backdrop-blur-md pointer-events-none">
                                  {cell.date.getDate()}/{cell.date.getMonth() + 1}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none">
                              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-[#3A5C34] group-hover:scale-110 transition-all">
                                <Plus size={14} />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-400">{cell.date.getDate()}/{cell.date.getMonth() + 1}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Stories lane — Instagram-only, a circle per day, below the grid. */}
          {showStories && (
            <StoriesLane
              days={storyDayList}
              groups={storyGroups}
              todayISO={todayISO}
              dragActive={storyDragActive}
              dropTargetISO={dropTargetISO}
              eventDays={eventDaysSet}
              onHoverDay={setDropTargetISO}
              onDropDay={dropStoryOnDay}
              onOpenDay={openStoryDay}
              onEditDay={editStoryDay}
              onDragStartDay={setStoryDragFromISO}
              onDayDragEnd={() => { setStoryDragFromISO(null); setDropTargetISO(null); }}
              onOpenEvents={setEventDay}
              onPickDay={(iso) => setSlotPicker({ iso, kind: 'story' })}
            />
          )}
          </div>

          {/* Feed preview — always visible. `relative` because the profile and
              highlight editors slide over it as absolutely-positioned sheets. */}
          <aside className="relative w-[360px] shrink-0 bg-white rounded-2xl shadow-sm border border-[#5F2427]/10 overflow-hidden">
            <FeedProfilePreview
              channel={channel}
              profile={mockupProfile}
              stored={brandProfiles?.[channel]}
              seed={brandName}
              onUpdateProfile={onUpdateBrandProfile ? (patch) => onUpdateBrandProfile(channel, patch) : undefined}
              items={feedItems} onOpen={setPreview} onEdit={setEditing} onReorder={handleMockupReorder}
            />
          </aside>
        </div>
      </div>

      {/* Sources panel — draggable posts to schedule, and the drop target for
          unscheduling: drag a placed post back here to free its date. */}
      <div
        className={`shrink-0 overflow-hidden bg-white border-l transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showSources ? 'w-72' : 'w-0'} ${overTray ? 'border-[#3A5C34] ring-2 ring-inset ring-[#3A5C34] bg-[#3A5C34]/5' : 'border-gray-200'}`}
        onDragOver={dragOriginISO ? (e) => { e.preventDefault(); setOverTray(true); } : undefined}
        onDragLeave={() => setOverTray(false)}
        onDrop={dragOriginISO ? (e) => { e.preventDefault(); if (dragItem) unschedule(dragItem); endDrag(); } : undefined}
      >
        <div className="w-72 h-full flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">Unscheduled</h3>
              <p className="text-[12px] text-gray-400">
                {dragOriginISO ? 'Drop here to unschedule' : 'Drag a post onto a slot to place it'}
              </p>
            </div>
            <button onClick={() => setShowSources(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {sources.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-center">
                <FileImage size={28} className="mb-2 opacity-20" />
                <p className="text-[13px] font-medium">All scheduled</p>
              </div>
            )}
            {sources.map(item => {
              const media = previewMedia(item.card);
              return (
                <div
                  key={item.card.id}
                  draggable
                  onDragStart={() => beginDrag(item, itemHasDate(item.card) ? (item.card.content as any).date : undefined)}
                  onDragEnd={endDrag}
                  onClick={() => setPreview(item.card)}
                  className="group flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-[#3A5C34]/30 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0 overflow-hidden">
                    {media?.type === 'image' ? <img src={media.url} className="w-full h-full object-cover" />
                      : media?.type === 'video' ? <VideoThumb url={media.url} thumbnail={media.thumbnail} />
                      : item.card.type === CardType.REELS ? <Video size={15} /> : <FileImage size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-800 truncate" dir="auto">{cardTitle(item.card)}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {item.card.type === CardType.REELS ? 'Reel' : 'Post'}
                      {itemHasDate(item.card) ? ` · ${new Date((item.card.content as any).date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · unscheduled'}
                    </p>
                  </div>
                  <button
                    aria-label="Edit"
                    onClick={(e) => { e.stopPropagation(); setEditing(item); }}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-[#3A5C34] transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Set-as-final confirm — a draft becoming the live schedule can unschedule
          in-month posts it omits, so we show the exact counts first. */}
      {finalizing && activeDraft && finalize && (
        <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center p-4" onClick={() => setFinalizing(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[380px] bg-white rounded-2xl shadow-xl border border-[#5F2427]/10 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-full bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center mb-4"><CheckCircle2 size={22} /></div>
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">Set “{activeDraft.name}” as final?</h3>
            <p className="text-[13px] text-gray-500 mb-3">This becomes the live schedule for {monthLabel} on {CHANNELS.find(c => c.id === channel)?.label}.</p>
            <p className="text-[13px] text-gray-700 mb-5">
              Schedules <b className="text-[#3A5C34]">{finalize.counts.schedule}</b> post{finalize.counts.schedule === 1 ? '' : 's'}
              {finalize.counts.unschedule > 0 && <> and unschedules <b className="text-[#5F2427]">{finalize.counts.unschedule}</b> that aren’t in this draft</>}.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFinalizing(false)} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={applyFinalize} className="h-9 px-4 rounded-lg text-[13px] font-bold bg-[#3A5C34] text-white hover:brightness-110 transition-all">Set as final</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && preview.type === CardType.REELS && <ReelsPreviewModal reel={preview} onClose={() => setPreview(null)} brandName={mockupProfile.displayName} username={mockupProfile.username} avatarUrl={mockupProfile.avatarUrl} />}
      {preview && preview.type !== CardType.REELS && <InstagramPreviewModal post={preview} onClose={() => setPreview(null)} brandName={mockupProfile.displayName} username={mockupProfile.username} avatarUrl={mockupProfile.avatarUrl} />}

      {/* Story viewer — one day's stories only (frames of that day's cards). */}
      {storyPreview && <StoryPreviewModal story={storyPreview} onClose={() => setStoryPreview(null)} brandName={mockupProfile.displayName} username={mockupProfile.username} avatarUrl={mockupProfile.avatarUrl} />}

      {/* Clicking an event marker on a slot / story day → read-only details. */}
      {eventDay && <EventDetailsModal events={eventsOnDate(eventDay)} dateISO={eventDay} onClose={() => setEventDay(null)} />}

      {/* Clicking an empty slot / story day → pick an unscheduled item for it. */}
      {slotPicker && (
        <SlotPickerModal
          dateISO={slotPicker.iso}
          kind={slotPicker.kind}
          items={slotPicker.kind === 'story' ? storySources : feedSources}
          onPick={(item) => { place(item, slotPicker.iso); setSlotPicker(null); }}
          onClose={() => setSlotPicker(null)}
        />
      )}

      {/* Edit the real card in fullscreen, straight from the Feed page.
          CRITICAL (data safety): resolve the LIVE card from `nodes` by id every
          render — never edit the frozen `editing.card` snapshot, or writing it back
          would revert/erase fields (incl. media) that changed since it was opened. */}
      {editing && (() => {
        const wsCards = nodes[editing.nodeId]?.whiteboardData?.find(ws => ws.id === editing.workspaceId)?.cards;
        const liveCard = wsCards?.find(c => c.id === editing.card.id) || null;
        if (!liveCard) { if (editing) setTimeout(() => setEditing(null), 0); return null; }
        // Mirror the whiteboard: if this post is linked to a Feed-Planner grid, lock
        // its date field and show the slot-derived date — editing it here otherwise
        // bypasses reconcile and gets reverted.
        const linked = findLinkedGrid(wsCards || [], liveCard.id);
        return (
          <FeedCardEditor
            card={liveCard}
            isLinked={!!linked}
            linkedDate={linked ? getSlotDate(linked.grid.content as any, linked.slotIndex) : undefined}
            onClose={() => setEditing(null)}
            onUpdateContent={(id, content) => onUpdateCard(editing.nodeId, editing.workspaceId, id, content)}
          />
        );
      })()}
    </div>
  );
};

// Renders a card's real editor (PostCard / ReelsCard / StoryCard) in BaseCard's
// controlled-fullscreen mode — a full-bleed portal — so a post can be edited from
// the Feed page without opening its whiteboard. Content writes go straight to the
// source board via onUpdateCard. Closing (minimize button or Escape) clears editing.
// `card` MUST be the live node card (resolved by id upstream), not a snapshot.
const FeedCardEditor: React.FC<{
  card: CardData;
  isLinked?: boolean;
  linkedDate?: Date;
  onClose: () => void;
  onUpdateContent: (id: string, content: any) => void;
}> = ({ card, isLinked, linkedDate, onClose, onUpdateContent }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const common = {
    card,
    isSelected: true,
    isExpanded: true,
    isFullscreen: true,
    zoomScale: 1,
    onUpdateContent,
    onFullscreenChange: (_id: string, next: boolean) => { if (!next) onClose(); },
    onSelect: () => {},
    onMove: () => {},
    onResize: () => {},
    onDelete: () => {},
  };

  // Stories aren't grid-linked; only Post/Reels take isLinked/linkedDate (date lock).
  if (card.type === CardType.REELS) return <ReelsCard {...common} isLinked={isLinked} linkedDate={linkedDate} />;
  if (card.type === CardType.STORY) return <StoryCard {...common} />;
  return <PostCard {...common} isLinked={isLinked} linkedDate={linkedDate} />;
};

// Ensure the card carries the given date AND a target/platform for this channel.
// dateStr=undefined clears the date (back to unscheduled) but keeps the channel.
function ensureChannel(card: CardData, channel: FeedChannel, dateStr: string | undefined): any {
  const content: any = { ...card.content, date: dateStr };
  // Stories are Instagram-only — just carry the date, no publish target.
  if (card.type === CardType.STORY) return content;
  if (card.type === CardType.REELS) {
    if (!content.platform) content.platform = channel; // reels channel = platform
    return content;
  }
  const targets = (content.publishTargets || []).slice();
  if (!targets.some((t: any) => t.platform === channel)) {
    targets.push({ id: `pt-${channel}-${Date.now()}-${Math.round(Math.random() * 1e4)}`, platform: channel, at: `${dateStr || toISODate(new Date())}T09:00`, status: 'scheduled' });
    content.publishTargets = targets;
  }
  return content;
}
