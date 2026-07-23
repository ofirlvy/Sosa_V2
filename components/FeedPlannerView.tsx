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
  const storyDragActive = !!dragItem && dragItem.card.type === CardType.STORY;
  const dropStoryOnDay = (iso: string) => {
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
    s