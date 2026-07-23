import { CardData, FeedCadence, FeedDraft } from '../types';
import { FeedItem, itemDate } from './feedPlanner';
import { parseISODate } from './dateUtils';

// Feed Drafts — saved monthly plans for a (channel, month). A draft is a pure
// OVERLAY of postId → date (+ its own cadence); the live schedule
// (post.content.date) stays the source of truth until "Set as final" commits a
// draft's dates onto the real posts. These are all pure functions; the view
// renders/edits them and useBrandSpaces persists them on the brand. See
// memory feed_planner_page / brand_spaces.

/** The drafts saved for one (channel, month). */
export const feedDraftsFor = (
  drafts: FeedDraft[] | undefined,
  channel: string,
  monthKey: string,
): FeedDraft[] => (drafts || []).filter(d => d.channel === channel && d.monthKey === monthKey);

/** Read a card's date FROM a draft's overlay (undefined = unscheduled in it). */
export const draftDateResolver = (draft: FeedDraft) =>
  (card: CardData): string | undefined => draft.dates[card.id];

/** Snapshot the currently-shown arrangement into a new draft: capture every
 *  item whose date (per `getDate`) falls in this month. Used by "Save current
 *  view as draft" — from Live it copies the live schedule, from a draft it
 *  duplicates that draft. */
export const createDraftFromArrangement = (
  items: FeedItem[],
  getDate: (card: CardData) => string | undefined,
  month: number,
  year: number,
  meta: { channel: string; monthKey: string; cadence: FeedCadence; name: string },
): FeedDraft => {
  const dates: { [postId: string]: string } = {};
  for (const it of items) {
    const iso = getDate(it.card);
    if (!iso) continue;
    const d = parseISODate(iso);
    if (d.getMonth() === month && d.getFullYear() === year) dates[it.card.id] = iso;
  }
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    name: meta.name,
    channel: meta.channel,
    monthKey: meta.monthKey,
    cadence: meta.cadence,
    dates,
    createdAt: now,
    updatedAt: now,
  };
};

/** Set (or, with iso=undefined, clear) one post's date in a draft — immutably.
 *  Never mutates the input. */
export const writeDraftDate = (
  draft: FeedDraft,
  postId: string,
  iso: string | undefined,
): FeedDraft => {
  const dates = { ...draft.dates };
  if (iso) dates[postId] = iso;
  else delete dates[postId];
  return { ...draft, dates, updatedAt: new Date().toISOString() };
};

/** Replace a draft's cadence — immutably. */
export const setDraftCadence = (draft: FeedDraft, cadence: FeedCadence): FeedDraft =>
  ({ ...draft, cadence, updatedAt: new Date().toISOString() });

export interface FinalizePlan {
  /** Posts the draft places → set to the draft's date. */
  writes: { item: FeedItem; date: string }[];
  /** Posts scheduled this month LIVE but absent from the draft → unschedule. */
  clears: FeedItem[];
  counts: { schedule: number; unschedule: number };
}

/** What "Set as final" must do to make the live schedule equal the draft for
 *  this (channel, month): write every placed post's draft date, and unschedule
 *  every live-in-month post the draft omits. The view runs each through
 *  assignToDate (→ resolveDateWrites) so linked planner slots + calendar sync. */
export const finalizePlan = (
  items: FeedItem[],
  draft: FeedDraft,
  month: number,
  year: number,
): FinalizePlan => {
  const byId = new Map(items.map(i => [i.card.id, i]));
  const writes: { item: FeedItem; date: string }[] = [];
  for (const [postId, iso] of Object.entries(draft.dates)) {
    const item = byId.get(postId);
    if (item) writes.push({ item, date: iso });
  }
  const clears: FeedItem[] = items.filter(i => {
    if (draft.dates[i.card.id]) return false; // placed by the draft → a write, not a clear
    const iso = itemDate(i.card);
    if (!iso) return false;                    // already unscheduled
    const d = parseISODate(iso);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  return { writes, clears, counts: { schedule: writes.length, unschedule: clears.length } };
};
