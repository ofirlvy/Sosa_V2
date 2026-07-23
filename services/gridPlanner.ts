import { CardData, CardType, GridPlannerContent, GridConfig } from '../types';
import { toISODate as toISO, parseISODate } from './dateUtils';

// Single source of truth for Feed Planner slot ↔ date logic, shared by
// GridPlannerCard (rendering), Canvas (getLinkedDate) and CalendarView (drag-to-schedule).

const DEFAULT_CONFIG: GridConfig = {
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  logicType: 'frequency',
  value: 3,
};

// Date computed purely from the config pattern for a given slot index.
function computedSlotDate(config: GridConfig, slotIndex: number): Date {
  const { month, year, logicType, value } = config;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let day = 1;
  if (logicType === 'frequency') {
    const step = Math.max(1, value);
    day = 1 + slotIndex * step;
  } else {
    const count = Math.max(1, Math.min(value, daysInMonth));
    const step = daysInMonth / count;
    day = Math.floor(1 + slotIndex * step);
  }
  if (day > daysInMonth) day = daysInMonth;
  if (day < 1) day = 1;
  return new Date(year, month, day);
}

// How many slots the config pattern generates.
function autoSlotCount(config: GridConfig): number {
  const { month, year, logicType, value } = config;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (logicType === 'frequency') {
    const step = Math.max(1, value);
    return Math.ceil(daysInMonth / step);
  }
  return Math.max(1, Math.min(value, daysInMonth));
}

// The effective date of a slot: explicit override wins, else computed from config.
export function getSlotDate(content: GridPlannerContent, slotIndex: number): Date {
  const config = content.config || DEFAULT_CONFIG;
  const override = content.slotDates?.[slotIndex];
  if (override) return parseISODate(override);
  return computedSlotDate(config, slotIndex);
}

export interface PlannerSlot { index: number; date: Date; label: string; }

// All slots: the config-generated set plus any extra indices that appear in
// connections/slotDates (e.g. rescheduled posts). Sorted by date ascending.
export function buildSlots(content: GridPlannerContent): PlannerSlot[] {
  const config = content.config || DEFAULT_CONFIG;
  const indices = new Set<number>();
  for (let i = 0; i < autoSlotCount(config); i++) indices.add(i);
  Object.keys(content.connections || {}).forEach(k => indices.add(parseInt(k)));
  Object.keys(content.slotDates || {}).forEach(k => indices.add(parseInt(k)));

  return Array.from(indices)
    .map(index => {
      const date = getSlotDate(content, index);
      return { index, date, label: `${date.getDate()}` };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Slot index whose effective date matches the given ISO date, or null.
export function findSlotForDate(content: GridPlannerContent, iso: string): number | null {
  const match = buildSlots(content).find(s => toISO(s.date) === iso);
  return match ? match.index : null;
}

// The grid (+ slot index) a post is connected to, if any.
export function findLinkedGrid(cards: CardData[], postId: string): { grid: CardData; slotIndex: number } | null {
  for (const c of cards) {
    if (c.type !== CardType.GRID_PLANNER) continue;
    const conns = (c.content as GridPlannerContent).connections || {};
    const key = Object.keys(conns).find(k => conns[parseInt(k)] === postId);
    if (key !== undefined) return { grid: c, slotIndex: parseInt(key) };
  }
  return null;
}

/**
 * Central reconciliation: derive every linked post's `content.date` from the slot
 * it occupies in its Feed Planner, so Calendar/Unscheduled (which read content.date)
 * stay in sync the moment a grid changes — independent of the PostCard rendering.
 * Pure + idempotent: returns the same array reference when nothing changed.
 */
export function syncLinkedDates(cards: CardData[]): CardData[] {
  const dateByPost: Record<string, string> = {};
  for (const c of cards) {
    if (c.type !== CardType.GRID_PLANNER) continue;
    const conns = (c.content as GridPlannerContent).connections || {};
    for (const k of Object.keys(conns)) {
      const idx = parseInt(k);
      const postId = conns[idx];
      if (!postId) continue;
      dateByPost[postId] = toISO(getSlotDate(c.content as GridPlannerContent, idx));
    }
  }
  let changed = false;
  const next = cards.map(c => {
    const iso = dateByPost[c.id];
    // Posts AND Reels can occupy Feed Planner slots — both carry content.date.
    if (iso && (c.type === CardType.POST || c.type === CardType.REELS) && (c.content as any)?.date !== iso) {
      changed = true;
      return { ...c, content: { ...c.content, date: iso } };
    }
    return c;
  });
  return changed ? next : cards;
}

/**
 * Reconcile all derived cross-card fields in one place. Future features that add a
 * cross-card relationship should add their derivation here (called from writeCards).
 */
export function reconcileCards(cards: CardData[]): CardData[] {
  return syncLinkedDates(cards);
}

// Returns updated grid content that places `postId` on `iso`:
// reuse a free matching slot if one exists, otherwise create a new dated slot.
export function scheduleLinkedPost(content: GridPlannerContent, postId: string, iso: string): GridPlannerContent {
  const connections = { ...(content.connections || {}) };
  const slotDates = { ...(content.slotDates || {}) };

  // Remove the post from its current slot.
  const currentKey = Object.keys(connections).find(k => connections[parseInt(k)] === postId);
  if (currentKey !== undefined) delete connections[parseInt(currentKey)];

  const targetIndex = findSlotForDate({ ...content, connections, slotDates }, iso);
  const targetFree = targetIndex !== null && connections[targetIndex] === undefined;

  if (targetIndex !== null && targetFree) {
    connections[targetIndex] = postId;
    // If the matched slot was a computed one, pin its date so it stays put.
    slotDates[targetIndex] = iso;
  } else {
    // Create a brand-new slot at this date.
    const allIndices = [
      ...Object.keys(connections).map(Number),
      ...Object.keys(slotDates).map(Number),
      autoSlotCount(content.config || DEFAULT_CONFIG) - 1,
    ];
    const newIndex = (allIndices.length ? Math.max(...allIndices) : -1) + 1;
    slotDates[newIndex] = iso;
    connections[newIndex] = postId;
  }

  return { ...content, connections, slotDates };
}

// Remove a post from its grid slot (used when a linked post is unscheduled, so
// syncLinkedDates won't re-derive its date from a still-connected slot). Pure.
export function unlinkPost(content: GridPlannerContent, postId: string): GridPlannerContent {
  const connections = { ...(content.connections || {}) };
  const key = Object.keys(connections).find(k => connections[parseInt(k)] === postId);
  if (key === undefined) return content;
  delete connections[parseInt(key)];
  return { ...content, connections };
}

/** One card write: `content` replaces that card's content via the usual onUpdateCard path. */
export interface DateWrite { cardId: string; content: any; }

/**
 * Every write needed to set — or CLEAR — an item's scheduled date. Shared by the
 * Feed page and the Calendar so the two can't drift apart.
 *
 * `dateStr === undefined` means UNSCHEDULE, and it is the reason this is one
 * function rather than a one-line content write: a post linked to a board
 * Feed-Planner card must also be unlinked from its slot, otherwise
 * `syncLinkedDates` immediately re-derives the date from the still-connected
 * slot and the item snaps straight back onto the grid.
 *
 * @param contentBase content to write the date onto (callers may pre-stamp it,
 *   e.g. the Feed page adds the channel's publish target first).
 * @param dateField which content field holds the date ('date', 'sendTime', …).
 *   An empty field means the card type isn't schedulable → no writes at all.
 */
export function resolveDateWrites(
  wsCards: CardData[],
  card: CardData,
  dateStr: string | undefined,
  contentBase: any = card.content,
  dateField: string = 'date',
): DateWrite[] {
  if (!dateField) return [];
  const writes: DateWrite[] = [];
  const linkable = card.type === CardType.POST || card.type === CardType.REELS;
  const linked = linkable ? findLinkedGrid(wsCards, card.id) : null;
  if (linked) {
    writes.push({
      cardId: linked.grid.id,
      content: dateStr
        ? scheduleLinkedPost(linked.grid.content as GridPlannerContent, card.id, dateStr)
        : unlinkPost(linked.grid.content as GridPlannerContent, card.id),
    });
  }
  writes.push({ cardId: card.id, content: { ...contentBase, [dateField]: dateStr } });
  return writes;
}
