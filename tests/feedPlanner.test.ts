import { describe, it, expect } from 'vitest';
import { CardData, CardType, FileSystemNode, PublishTarget } from '../types';
import { cardTargetsChannel, collectFeedItems, buildFeedMonth, unplacedItems, FeedItem, normalizeCadence, cadenceStepDays, orderedFeedItems, feedMonthKey, resolveMonthCadence, writeMonthCadence, collectStoryItems, storyDayGroups, monthDays, dayStoryFrames } from '../services/feedPlanner';

// Cross-board feed lens: correct channel membership, cross-board collection,
// and month assembly (real posts + ghost cadence slots). If these break, the
// feed page shows the wrong posts or double-counts dates.

const post = (id: string, date?: string, targets?: PublishTarget[]): CardData => ({
  id, type: CardType.POST, x: 0, y: 0, width: 300, height: 400, zIndex: 1,
  content: { title: id, date, publishTargets: targets } as any,
});
const reel = (id: string, date?: string, platform?: 'instagram' | 'tiktok'): CardData => ({
  id, type: CardType.REELS, x: 0, y: 0, width: 220, height: 390, zIndex: 1,
  content: { title: id, date, platform } as any,
});
const igTarget = (): PublishTarget => ({ id: 't', platform: 'instagram', at: '2026-07-01T09:00:00Z', status: 'scheduled' });

describe('cardTargetsChannel', () => {
  it('post: matches by publishTargets; untargeted shows everywhere', () => {
    expect(cardTargetsChannel(post('p', undefined, [igTarget()]), 'instagram')).toBe(true);
    expect(cardTargetsChannel(post('p', undefined, [igTarget()]), 'tiktok')).toBe(false);
    expect(cardTargetsChannel(post('p'), 'instagram')).toBe(true);  // unassigned
    expect(cardTargetsChannel(post('p'), 'tiktok')).toBe(true);     // unassigned
  });
  it('reel: matches by platform; undefined shows everywhere', () => {
    expect(cardTargetsChannel(reel('r', undefined, 'tiktok'), 'tiktok')).toBe(true);
    expect(cardTargetsChannel(reel('r', undefined, 'tiktok'), 'instagram')).toBe(false);
    expect(cardTargetsChannel(reel('r'), 'instagram')).toBe(true);
  });
});

const nodes = (): Record<string, FileSystemNode> => ({
  brand: { id: 'brand', type: 'folder', name: 'Brand', parentId: null } as FileSystemNode,
  sub: { id: 'sub', type: 'folder', name: 'Sub', parentId: 'brand' } as FileSystemNode,
  wbA: { id: 'wbA', type: 'whiteboard', name: 'A', parentId: 'brand',
    whiteboardData: [{ id: 't1', name: 'S', cards: [post('p1', '2026-07-05', [igTarget()]), reel('r1', undefined, 'tiktok')] }] } as FileSystemNode,
  wbB: { id: 'wbB', type: 'whiteboard', name: 'B', parentId: 'sub', // nested under brand
    whiteboardData: [{ id: 't1', name: 'S', cards: [post('p2', '2026-07-20', [igTarget()])] }] } as FileSystemNode,
  wbOther: { id: 'wbOther', type: 'whiteboard', name: 'O', parentId: 'other',
    whiteboardData: [{ id: 't1', name: 'S', cards: [post('p3', '2026-07-06', [igTarget()])] }] } as FileSystemNode,
});

describe('collectFeedItems (cross-board, nested folder)', () => {
  it('gathers IG posts under the brand folder (incl. nested), excludes other folders and off-channel', () => {
    const ids = collectFeedItems(nodes(), 'brand', 'instagram').map(i => i.card.id).sort();
    expect(ids).toEqual(['p1', 'p2']); // p3 is in another folder; r1 is tiktok-only
  });
});

describe('buildFeedMonth', () => {
  const items = collectFeedItems(nodes(), 'brand', 'instagram');
  it('places real posts on their dates + fills ghost cadence slots, sorted, no date collisions', () => {
    const cells = buildFeedMonth(items, { mode: 'everyNDays', value: 5 }, 6, 2026); // July
    const real = cells.filter(c => !c.ghost).map(c => c.item!.card.id);
    expect(real).toEqual(['p1', 'p2']); // 5th, 20th
    // sorted ascending by date
    const times = cells.map(c => c.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // no ghost lands on a taken real date
    const realIso = new Set(cells.filter(c => !c.ghost).map(c => c.date.toDateString()));
    expect(cells.filter(c => c.ghost).every(c => !realIso.has(c.date.toDateString()))).toBe(true);
  });
});

describe('buildFeedMonth — event-aware slots', () => {
  const cadence = { mode: 'everyNDays' as const, value: 3 }; // July: 1,4,7,10,...,31
  const ghostDays = (cells: ReturnType<typeof buildFeedMonth>) =>
    cells.filter(c => c.ghost).map(c => c.date.getDate()).sort((a, b) => a - b);

  it('guarantees a slot on an event day and merges away the adjacent cadence slot', () => {
    const cells = buildFeedMonth([], cadence, 6, 2026, ['2026-07-05']);
    const days = ghostDays(cells);
    expect(days).toContain(5);      // event day guaranteed
    expect(days).not.toContain(4);  // adjacent (±1) cadence slot merged away
    expect(days).toContain(7);      // non-adjacent cadence slot preserved
    expect(cells.find(c => c.date.getDate() === 5)?.event).toBe(true);
  });

  it('an event exactly on a cadence day stays a single slot (no far-neighbor loss)', () => {
    const cells = buildFeedMonth([], cadence, 6, 2026, ['2026-07-04']);
    const days = ghostDays(cells);
    expect(days.filter(d => d === 4)).toHaveLength(1);
    expect(days).toContain(1);
    expect(days).toContain(7);
    expect(cells.find(c => c.date.getDate() === 4)?.event).toBe(true);
  });

  it('adds no ghost when a post already covers the event day', () => {
    const items: FeedItem[] = [{ card: post('x', '2026-07-05'), nodeId: 'n', workspaceId: 'w' }];
    const onFifth = buildFeedMonth(items, cadence, 6, 2026, ['2026-07-05']).filter(c => c.date.getDate() === 5);
    expect(onFifth).toHaveLength(1);
    expect(onFifth[0].ghost).toBe(false); // the real post covers it, not a ghost
  });

  it('honors a custom getDate resolver (draft overlay) instead of content.date', () => {
    // The post's LIVE date is the 5th, but the draft resolver places it on the 20th.
    const items: FeedItem[] = [{ card: post('x', '2026-07-05'), nodeId: 'n', workspaceId: 'w' }];
    const draftDates: Record<string, string> = { x: '2026-07-20' };
    const cells = buildFeedMonth(items, { mode: 'perWeek', value: 1 }, 6, 2026, [], c => draftDates[c.id]);
    const real = cells.filter(c => !c.ghost);
    expect(real).toHaveLength(1);
    expect(real[0].date.getDate()).toBe(20); // draft's date, not the live 5th
    // A post the draft doesn't place (no key) is absent from the grid.
    const items2: FeedItem[] = [{ card: post('y', '2026-07-05'), nodeId: 'n', workspaceId: 'w' }];
    const empty = buildFeedMonth(items2, { mode: 'perWeek', value: 1 }, 6, 2026, [], () => undefined);
    expect(empty.filter(c => !c.ghost)).toHaveLength(0);
  });
});

describe('cadence mapping', () => {
  it('everyNDays → step = N; perWeek → step ≈ 7/N', () => {
    expect(cadenceStepDays({ mode: 'everyNDays', value: 4 })).toBe(4);
    expect(cadenceStepDays({ mode: 'perWeek', value: 3 })).toBe(2); // round(7/3)=2
    expect(cadenceStepDays({ mode: 'perWeek', value: 7 })).toBe(1);
    expect(cadenceStepDays({ mode: 'perWeek', value: 1 })).toBe(7);
  });
  it('normalizeCadence tolerates legacy {logicType,value}', () => {
    expect(normalizeCadence({ logicType: 'frequency', value: 5 })).toEqual({ mode: 'everyNDays', value: 5 });
    expect(normalizeCadence(undefined)).toEqual({ mode: 'perWeek', value: 3 });
  });
});

describe('orderedFeedItems', () => {
  it('keeps only dated items, newest first (profile order)', () => {
    const items: FeedItem[] = [
      { card: post('a', '2026-07-05'), nodeId: 'n', workspaceId: 'w' },
      { card: post('b'), nodeId: 'n', workspaceId: 'w' },
      { card: post('c', '2026-08-01'), nodeId: 'n', workspaceId: 'w' },
    ];
    expect(orderedFeedItems(items).map(i => i.card.id)).toEqual(['c', 'a']);
  });
});

describe('unplacedItems', () => {
  it('returns ONLY undated items (a dated post stays scheduled regardless of month)', () => {
    const items: FeedItem[] = [
      { card: post('a', '2026-07-05'), nodeId: 'n', workspaceId: 'w' },
      { card: post('b'), nodeId: 'n', workspaceId: 'w' },
      { card: post('c', '2026-08-01'), nodeId: 'n', workspaceId: 'w' },
    ];
    expect(unplacedItems(items).map(i => i.card.id).sort()).toEqual(['b']);
  });
});

// Cadence is remembered per (channel, month) on the brand — the whole point is
// that July can differ from August, and IG from TikTok in the same month.
describe('per-month cadence storage', () => {
  it('feedMonthKey is a LOCAL YYYY-MM (zero-padded)', () => {
    expect(feedMonthKey(2026, 6)).toBe('2026-07');   // month is 0-indexed
    expect(feedMonthKey(2026, 0)).toBe('2026-01');
    expect(feedMonthKey(2026, 11)).toBe('2026-12');
  });

  it('resolves an untouched (channel, month) to the neutral default — no hidden inheritance', () => {
    const map = { instagram: { '2026-07': { mode: 'everyNDays', value: 1 } as const } };
    // August was never set → default, NOT July's daily cadence.
    expect(resolveMonthCadence(map, 'instagram', '2026-08')).toEqual({ mode: 'perWeek', value: 3 });
    expect(resolveMonthCadence(undefined, 'tiktok', '2026-07')).toEqual({ mode: 'perWeek', value: 3 });
  });

  it('reads back exactly what was stored (through normalizeCadence)', () => {
    const map = { instagram: { '2026-07': { mode: 'everyNDays', value: 1 } as const } };
    expect(resolveMonthCadence(map, 'instagram', '2026-07')).toEqual({ mode: 'everyNDays', value: 1 });
  });

  it('writes one (channel, month) without disturbing any other', () => {
    let map = writeMonthCadence(undefined, 'instagram', '2026-07', { mode: 'perWeek', value: 2 });
    map = writeMonthCadence(map, 'instagram', '2026-08', { mode: 'everyNDays', value: 1 });
    map = writeMonthCadence(map, 'tiktok', '2026-07', { mode: 'everyNDays', value: 1 }); // "2/day"-ish

    // July IG unchanged by the later writes.
    expect(resolveMonthCadence(map, 'instagram', '2026-07')).toEqual({ mode: 'perWeek', value: 2 });
    // August IG independent.
    expect(resolveMonthCadence(map, 'instagram', '2026-08')).toEqual({ mode: 'everyNDays', value: 1 });
    // TikTok July independent of IG July, same month.
    expect(resolveMonthCadence(map, 'tiktok', '2026-07')).toEqual({ mode: 'everyNDays', value: 1 });
    expect(resolveMonthCadence(map, 'instagram', '2026-07')).not.toEqual(resolveMonthCadence(map, 'tiktok', '2026-07'));
  });

  it('is immutable — writing returns a new map and never mutates the input', () => {
    const before = { instagram: { '2026-07': { mode: 'perWeek', value: 3 } as const } };
    const snapshot = JSON.stringify(before);
    const after = writeMonthCadence(before, 'instagram', '2026-07', { mode: 'everyNDays', value: 2 });
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after).not.toBe(before);
  });
});

// Stories are Instagram-only, live in a per-day circle lane below the grid
// (never in the rectangular grid), and are viewed one day at a time.
const story = (id: string, date?: string, frames: any[] = []): CardData => ({
  id, type: CardType.STORY, x: 0, y: 0, width: 240, height: 400, zIndex: 1,
  content: { title: id, date, frames } as any,
});

describe('collectStoryItems', () => {
  it('gathers STORY cards under scope, ignoring POST/REEL', () => {
    const ns: Record<string, FileSystemNode> = {
      brand: { id: 'brand', type: 'folder', name: 'B', parentId: null } as FileSystemNode,
      wb: { id: 'wb', type: 'whiteboard', name: 'A', parentId: 'brand',
        whiteboardData: [{ id: 't', name: 'S', cards: [story('s1', '2026-07-03'), post('p1', '2026-07-04'), reel('r1')] }] } as FileSystemNode,
    };
    expect(collectStoryItems(ns, 'all').map(i => i.card.id)).toEqual(['s1']);
  });
});

describe('monthDays', () => {
  it('is every LOCAL day of the month', () => {
    const days = monthDays(6, 2026); // July
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-07-01');
    expect(days[30]).toBe('2026-07-31');
    expect(monthDays(1, 2026)).toHaveLength(28); // Feb 2026
  });
});

describe('storyDayGroups', () => {
  const items: FeedItem[] = [
    { card: story('a', '2026-07-10'), nodeId: 'n', workspaceId: 'w' },
    { card: story('b', '2026-07-10'), nodeId: 'n', workspaceId: 'w' }, // same day → grouped
    { card: story('c', '2026-07-03'), nodeId: 'n', workspaceId: 'w' },
    { card: story('d'), nodeId: 'n', workspaceId: 'w' },               // undated → excluded
    { card: story('e', '2026-08-01'), nodeId: 'n', workspaceId: 'w' }, // other month → excluded
  ];
  it('groups the month\'s dated stories by day, chronological', () => {
    const groups = storyDayGroups(items, 6, 2026);
    expect(groups.map(g => g.iso)).toEqual(['2026-07-03', '2026-07-10']);
    expect(groups[1].items.map(i => i.card.id)).toEqual(['a', 'b']);
  });
  it('honors a getDate overlay (draft) instead of content.date', () => {
    const overlay: Record<string, string> = { c: '2026-07-25' };
    const groups = storyDayGroups(items, 6, 2026, card => overlay[card.id]);
    expect(groups.map(g => g.iso)).toEqual(['2026-07-25']); // only c, moved
  });
});

describe('dayStoryFrames', () => {
  it('concatenates a day\'s story frames in card order', () => {
    const dayItems: FeedItem[] = [
      { card: story('a', '2026-07-10', [{ id: 'f1' }, { id: 'f2' }] as any), nodeId: 'n', workspaceId: 'w' },
      { card: story('b', '2026-07-10', [{ id: 'f3' }] as any), nodeId: 'n', workspaceId: 'w' },
    ];
    expect(dayStoryFrames(dayItems).map((f: any) => f.id)).toEqual(['f1', 'f2', 'f3']);
  });
});
