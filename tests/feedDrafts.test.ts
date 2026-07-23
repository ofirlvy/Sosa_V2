import { describe, it, expect } from 'vitest';
import { CardData, CardType, FeedDraft } from '../types';
import { FeedItem, itemDate } from '../services/feedPlanner';
import {
  feedDraftsFor, draftDateResolver, createDraftFromArrangement,
  writeDraftDate, setDraftCadence, finalizePlan,
} from '../services/feedDrafts';

// Feed Drafts: a draft is an overlay of postId→date for one (channel, month).
// These pin the pure logic that keeps drafts from ever touching live posts
// until "Set as final".

const post = (id: string, date?: string): CardData => ({
  id, type: CardType.POST, x: 0, y: 0, width: 300, height: 400, zIndex: 1,
  content: { title: id, date } as any,
});
const item = (id: string, date?: string): FeedItem => ({ card: post(id, date), nodeId: 'n', workspaceId: 'w' });
const draft = (over: Partial<FeedDraft> = {}): FeedDraft => ({
  id: 'd1', name: 'Draft 1', channel: 'instagram', monthKey: '2026-07',
  cadence: { mode: 'perWeek', value: 3 }, dates: {}, createdAt: 'now', ...over,
});

describe('feedDraftsFor', () => {
  it('filters to the (channel, month) — nothing bleeds across', () => {
    const all: FeedDraft[] = [
      draft({ id: 'a', channel: 'instagram', monthKey: '2026-07' }),
      draft({ id: 'b', channel: 'instagram', monthKey: '2026-08' }),
      draft({ id: 'c', channel: 'tiktok', monthKey: '2026-07' }),
    ];
    expect(feedDraftsFor(all, 'instagram', '2026-07').map(d => d.id)).toEqual(['a']);
    expect(feedDraftsFor(undefined, 'instagram', '2026-07')).toEqual([]);
  });
});

describe('draftDateResolver', () => {
  it('reads a card date from the overlay, undefined when unplaced', () => {
    const get = draftDateResolver(draft({ dates: { x: '2026-07-10' } }));
    expect(get(post('x'))).toBe('2026-07-10');
    expect(get(post('y'))).toBeUndefined();
  });
});

describe('createDraftFromArrangement', () => {
  it('snapshots ONLY in-month dated items from the given resolver', () => {
    const items = [item('a', '2026-07-05'), item('b'), item('c', '2026-08-01')];
    const d = createDraftFromArrangement(items, itemDate, 6, 2026, {
      channel: 'instagram', monthKey: '2026-07', cadence: { mode: 'perWeek', value: 2 }, name: 'July A',
    });
    expect(d.dates).toEqual({ a: '2026-07-05' }); // b undated, c is August
    expect(d.name).toBe('July A');
    expect(d.channel).toBe('instagram');
    expect(d.cadence).toEqual({ mode: 'perWeek', value: 2 });
  });
});

describe('writeDraftDate', () => {
  it('adds, overwrites and removes without mutating the input', () => {
    const before = draft({ dates: { a: '2026-07-01' } });
    const snap = JSON.stringify(before);
    const added = writeDraftDate(before, 'b', '2026-07-09');
    expect(added.dates).toEqual({ a: '2026-07-01', b: '2026-07-09' });
    const removed = writeDraftDate(added, 'a', undefined);
    expect(removed.dates).toEqual({ b: '2026-07-09' });
    expect(JSON.stringify(before)).toBe(snap); // immutable
    expect(added).not.toBe(before);
  });
});

describe('setDraftCadence', () => {
  it('replaces cadence immutably', () => {
    const before = draft();
    const after = setDraftCadence(before, { mode: 'everyNDays', value: 2 });
    expect(after.cadence).toEqual({ mode: 'everyNDays', value: 2 });
    expect(before.cadence).toEqual({ mode: 'perWeek', value: 3 });
  });
});

describe('finalizePlan', () => {
  it('writes the draft placements and clears in-month live posts the draft omits', () => {
    const items = [
      item('a', '2026-07-05'), // live July, placed by draft → write
      item('b', '2026-07-20'), // live July, NOT in draft → clear
      item('c'),               // unscheduled, placed by draft → write
      item('d', '2026-08-01'), // live August, not in draft → left alone
    ];
    const d = draft({ dates: { a: '2026-07-12', c: '2026-07-25' } });
    const plan = finalizePlan(items, d, 6, 2026);
    expect(plan.writes.map(w => [w.item.card.id, w.date]).sort()).toEqual([['a', '2026-07-12'], ['c', '2026-07-25']]);
    expect(plan.clears.map(c => c.card.id)).toEqual(['b']); // NOT d (August)
    expect(plan.counts).toEqual({ schedule: 2, unschedule: 1 });
  });

  it('ignores draft keys with no matching item (deleted post)', () => {
    const items = [item('a', '2026-07-05')];
    const d = draft({ dates: { a: '2026-07-10', ghost: '2026-07-11' } });
    const plan = finalizePlan(items, d, 6, 2026);
    expect(plan.writes.map(w => w.item.card.id)).toEqual(['a']); // no 'ghost'
    expect(plan.counts.schedule).toBe(1);
  });
});
