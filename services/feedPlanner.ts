import { FileSystemNode, CardData, CardType, GridPlannerContent, PostCardContent, ReelsCardContent, FeedCadence, MediaItem, StoryCardContent } from '../types';
import { toISODate, parseISODate } from './dateUtils';
import { buildSlots } from './gridPlanner';

// Account-level Feed Planner logic — a cross-board lens over posts' dates for a
// brand (folder) + channel. Pure functions (unit-tested); the view renders them.
// Source of truth stays each post's content.date (+ its publish target/platform);
// this only reads/aggregates. See memory sync_invariants / social_engine.

export type FeedChannel = 'instagram' | 'tiktok';

export interface FeedItem {
  card: CardData;
  nodeId: string;
  workspaceId: string;
}

/** ISO date a post/reel is scheduled for (its own content.date), or undefined. */
export const itemDate = (card: CardData): string | undefined => (card.content as any)?.date || undefined;

/**
 * Does a POST/REEL belong to this channel's feed?
 * REEL → its `platform` (undefined = unassigned, shown everywhere).
 * POST → any publishTarget with this platform; NO targets = unassigned, shown.
 */
export const cardTargetsChannel = (card: CardData, channel: FeedChannel): boolean => {
  if (card.type === CardType.REELS) {
    const p = (card.content as ReelsCardContent).platform;
    return !p || p === channel;
  }
  if (card.type === CardType.POST) {
    const targets = (card.content as PostCardContent).publishTargets || [];
    if (targets.length === 0) return true; // unassigned → visible in any channel
    return targets.some(t => t.platform === channel);
  }
  return false;
};

// Does whiteboard `node` fall within `scopeId`? 'all' → yes; the board itself
// (node.id === scopeId) → yes; else walk parentId up (folder membership).
const isInScope = (nodes: Record<string, FileSystemNode>, node: FileSystemNode, scopeId: string): boolean => {
  if (scopeId === 'all') return true;
  if (node.id === scopeId) return true;
  let cur = node.parentId;
  let guard = 0;
  while (cur && guard++ < 64) {
    if (cur === scopeId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
};

/** All POST/REEL feed items for (scope, channel) across every whiteboard.
 *  `scopeId` = 'all' | a whiteboard id (that board only) | a folder id (its boards). */
export const collectFeedItems = (
  nodes: Record<string, FileSystemNode>,
  scopeId: string,
  channel: FeedChannel
): FeedItem[] => {
  const items: FeedItem[] = [];
  for (const node of Object.values(nodes)) {
    if (node?.type !== 'whiteboard' || !node.whiteboardData) continue;
    if (!isInScope(nodes, node, scopeId)) continue;
    for (const ws of node.whiteboardData) {
      for (const card of ws.cards || []) {
        if ((card.type === CardType.POST || card.type === CardType.REELS) && cardTargetsChannel(card, channel)) {
          items.push({ card, nodeId: node.id, workspaceId: ws.id });
        }
      }
    }
  }
  return items;
};

/** All STORY items across every whiteboard under `scopeId`. Stories are
 *  Instagram-only (no channel/platform), so there's no channel filter —
 *  they render in the Feed page's story lane, never the rectangular grid. */
export const collectStoryItems = (
  nodes: Record<string, FileSystemNode>,
  scopeId: string
): FeedItem[] => {
  const items: FeedItem[] = [];
  for (const node of Object.values(nodes)) {
    if (node?.type !== 'whiteboard' || !node.whiteboardData) continue;
    if (!isInScope(nodes, node, scopeId)) continue;
    for (const ws of node.whiteboardData) {
      for (const card of ws.cards || []) {
        if (card.type === CardType.STORY) items.push({ card, nodeId: node.id, workspaceId: ws.id });
      }
    }
  }
  return items;
};

/**
 * Coerce any stored/partial cadence into the current shape.
 * Tolerates the legacy `{logicType,value}` form (maps it to everyNDays).
 */
export const normalizeCadence = (c: any): FeedCadence => {
  if (c && (c.mode === 'perWeek' || c.mode === 'everyNDays') && typeof c.value === 'number') {
    return { mode: c.mode, value: c.value };
  }
  if (c && typeof c.value === 'number') {
    // legacy: 'frequency' meant "every N days"; approximate 'count' the same way.
    return { mode: 'everyNDays', value: Math.max(1, c.value) };
  }
  return DEFAULT_FEED_CADENCE;
};

// --- Cadence remembered per (channel, month) -------------------------------
// Stored on the brand as feedCadence[channel][monthKey]. Each combination is
// independent: July can differ from August, IG from TikTok in the same month.

export type FeedCadenceMap = { [channel: string]: { [monthKey: string]: FeedCadence } };

/** "YYYY-MM" for a LOCAL month (never toISOString — see dateUtils). */
export const feedMonthKey = (year: number, month: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

/** The cadence for one (channel, month). Untouched months fall back to the
 *  neutral default — no hidden inheritance, since the user wants months to be
 *  independent. */
export const resolveMonthCadence = (
  map: FeedCadenceMap | undefined,
  channel: string,
  monthKey: string,
): FeedCadence => {
  const stored = map?.[channel]?.[monthKey];
  return stored ? normalizeCadence(stored) : DEFAULT_FEED_CADENCE;
};

/** Set one (channel, month)'s cadence, immutably, without touching any other
 *  channel or month. */
export const writeMonthCadence = (
  map: FeedCadenceMap | undefined,
  channel: string,
  monthKey: string,
  cadence: FeedCadence,
): FeedCadenceMap => ({
  ...map,
  [channel]: { ...(map?.[channel]), [monthKey]: cadence },
});

/** The day-step a cadence resolves to (reused by the board planner's frequency logic). */
export const cadenceStepDays = (cadence: FeedCadence): number => {
  const c = normalizeCadence(cadence);
  if (c.mode === 'perWeek') return Math.max(1, Math.round(7 / Math.max(1, c.value)));
  return Math.max(1, c.value);
};

/** Cadence "ghost" slot dates for a month — reuses the board planner's slot math. */
export const ghostSlotDates = (cadence: FeedCadence, month: number, year: number): Date[] => {
  const content: GridPlannerContent = {
    config: { month, year, logicType: 'frequency', value: cadenceStepDays(cadence) },
    connections: {},
  };
  return buildSlots(content).map(s => s.date);
};

export interface FeedCell {
  date: Date;
  item?: FeedItem;
  ghost: boolean;  // true = empty slot to fill
  event?: boolean; // true = this ghost exists because a calendar event falls on it
}

const dayDiff = (a: string, b: string): number =>
  Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86400000);

/**
 * The ordered cells for a month: real scheduled posts on their dates + empty
 * slots to fill. Empty slots come from the cadence rhythm PLUS any calendar
 * event day (so you can always plan a post around an event). Sorted chronologically.
 *
 * Smart merge: an event day is guaranteed a slot; cadence slots immediately
 * adjacent (±1 day) to an event day are dropped so the event slot replaces them
 * instead of sitting cramped next to them. The rest of the cadence is preserved.
 */
export const buildFeedMonth = (
  items: FeedItem[],
  cadence: FeedCadence,
  month: number,
  year: number,
  eventDates: string[] = [],
  // How to read a card's scheduled date. Defaults to its live content.date;
  // a draft passes an overlay resolver so the grid renders the DRAFT's dates
  // without touching the posts. See services/feedDrafts.
  getDate: (card: CardData) => string | undefined = itemDate,
): FeedCell[] => {
  const inMonth = items.filter(i => {
    const iso = getDate(i.card);
    if (!iso) return false;
    const d = parseISODate(iso);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const realCells: FeedCell[] = inMonth.map(i => ({ date: parseISODate(getDate(i.card)!), item: i, ghost: false }));
  const taken = new Set(realCells.map(c => toISODate(c.date)));

  // Event anchor days in this month that no post already covers.
  const eventDays = [...new Set(eventDates)].filter(iso => {
    const d = parseISODate(iso);
    return d.getMonth() === month && d.getFullYear() === year && !taken.has(iso);
  });
  const eventSet = new Set(eventDays);
  const nearEvent = (iso: string) => eventDays.some(e => Math.abs(dayDiff(iso, e)) <= 1);

  // Cadence ghosts: skip taken dates and any date adjacent to an event day.
  const ghostSet = new Set(
    ghostSlotDates(cadence, month, year)
      .map(toISODate)
      .filter(iso => !taken.has(iso) && !nearEvent(iso))
  );
  const cadenceOnly = new Set(ghostSet);
  eventDays.forEach(iso => ghostSet.add(iso)); // guarantee the event-day slot

  const ghosts: FeedCell[] = [...ghostSet].map(iso => ({
    date: parseISODate(iso),
    ghost: true,
    event: eventSet.has(iso) && !cadenceOnly.has(iso),
  }));
  return [...realCells, ...ghosts].sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * The "To schedule" source rail = only items with NO date. Once a post has a
 * date it's scheduled — it belongs to that date, not this list, regardless of
 * which month the grid is currently showing.
 */
export const unplacedItems = (
  items: FeedItem[],
  getDate: (card: CardData) => string | undefined = itemDate,
): FeedItem[] =>
  items.filter(i => !getDate(i.card));

/** Dated items ordered as a social profile grid: newest first (top-left). */
export const orderedFeedItems = (
  items: FeedItem[],
  getDate: (card: CardData) => string | undefined = itemDate,
): FeedItem[] =>
  items
    .filter(i => !!getDate(i.card))
    .sort((a, b) => (getDate(b.card)! < getDate(a.card)! ? -1 : getDate(b.card)! > getDate(a.card)! ? 1 : 0));

export const DEFAULT_FEED_CADENCE: FeedCadence = { mode: 'perWeek', value: 3 };

// --- Story lane (Instagram-only, a circle per day below the grid) -----------

/** Every day of a month as a LOCAL ISO string (never toISOString — see dateUtils). */
export const monthDays = (month: number, year: number): string[] => {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => toISODate(new Date(year, month, i + 1)));
};

/** Dated stories of the shown month, grouped by day (ISO → the day's items),
 *  chronological. `getDate` lets a draft overlay move stories like posts. */
export const storyDayGroups = (
  items: FeedItem[],
  month: number,
  year: number,
  getDate: (card: CardData) => string | undefined = itemDate,
): { iso: string; items: FeedItem[] }[] => {
  const byDay = new Map<string, FeedItem[]>();
  for (const it of items) {
    const iso = getDate(it.card);
    if (!iso) continue;
    const d = parseISODate(iso);
    if (d.getMonth() !== month || d.getFullYear() !== year) continue;
    (byDay.get(iso) || byDay.set(iso, []).get(iso)!).push(it);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([iso, dayItems]) => ({ iso, items: dayItems }));
};

/** All frames of a day's story cards, in card order — fed to StoryPreviewModal
 *  so tapping a day plays only THAT day's stories, not the whole month. */
export const dayStoryFrames = (dayItems: FeedItem[]): MediaItem[] =>
  dayItems.flatMap(i => (i.card.content as StoryCardContent).frames || []);
