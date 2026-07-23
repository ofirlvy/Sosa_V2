import { describe, it, expect } from 'vitest';
import { CardData, CardType, GridPlannerContent } from '../types';
import {
  reconcileCards, syncLinkedDates, getSlotDate, scheduleLinkedPost, findSlotForDate, unlinkPost, resolveDateWrites,
} from '../services/gridPlanner';
import { toISODate } from '../services/dateUtils';

// Cross-card sync invariant: a Feed-Planner-linked POST/REEL's date is derived
// centrally from the slot it occupies. If this desyncs, the Calendar silently
// shows the wrong date. See memory sync_invariants.

const gridContent = (connections: Record<number, string>): GridPlannerContent => ({
  title: 'Feed',
  config: { month: 6, year: 2026, logicType: 'frequency', value: 3 },
  connections,
});

const grid = (connections: Record<number, string>): CardData => ({
  id: 'grid-1', type: CardType.GRID_PLANNER, x: 0, y: 0, width: 300, height: 400, zIndex: 1,
  content: gridContent(connections),
});
const post = (id: string, date?: string): CardData => ({
  id, type: CardType.POST, x: 0, y: 0, width: 300, height: 400, zIndex: 1,
  content: { date } as any,
});
const reel = (id: string, date?: string): CardData => ({
  id, type: CardType.REELS, x: 0, y: 0, width: 220, height: 390, zIndex: 1,
  content: { date } as any,
});

describe('reconcileCards / syncLinkedDates', () => {
  it('derives a linked POST date from its slot', () => {
    const cards = [grid({ 0: 'p1' }), post('p1')];
    const out = reconcileCards(cards);
    const p = out.find(c => c.id === 'p1')!;
    expect((p.content as any).date).toBe(toISODate(getSlotDate(gridContent({ 0: 'p1' }), 0)));
  });

  it('derives a linked REEL date too (reels can occupy slots)', () => {
    const cards = [grid({ 1: 'r1' }), reel('r1')];
    const out = reconcileCards(cards);
    const r = out.find(c => c.id === 'r1')!;
    expect((r.content as any).date).toBe(toISODate(getSlotDate(gridContent({ 1: 'r1' }), 1)));
  });

  it('is idempotent — reconcile(reconcile(x)) equals reconcile(x)', () => {
    const once = reconcileCards([grid({ 0: 'p1' }), post('p1')]);
    const twice = reconcileCards(once);
    expect(twice).toEqual(once);
  });

  it('returns the SAME array reference when nothing changes (no churn)', () => {
    const already = reconcileCards([grid({ 0: 'p1' }), post('p1')]);
    expect(syncLinkedDates(already)).toBe(already);
  });
});

describe('scheduleLinkedPost ↔ findSlotForDate round-trip', () => {
  it('scheduling a post on a date makes that date resolve back to its slot', () => {
    const iso = '2026-07-15';
    const next = scheduleLinkedPost(gridContent({}), 'p1', iso);
    const slot = findSlotForDate(next, iso);
    expect(slot).not.toBeNull();
    expect(next.connections[slot!]).toBe('p1');
    expect(toISODate(getSlotDate(next, slot!))).toBe(iso);
  });
});

// Unscheduling is the mirror of scheduling and has one non-obvious rule: a post
// linked to a board Feed-Planner card must ALSO leave its slot, or
// syncLinkedDates re-derives the date and the item snaps back onto the grid.
describe('resolveDateWrites', () => {
  it('CRITICAL: unscheduling a linked post unlinks the slot AND clears the date', () => {
    const p = post('p1', '2026-07-10');
    const writes = resolveDateWrites([grid({ 0: 'p1' }), p], p, undefined);
    expect(writes).toHaveLength(2);
    expect(writes[0].cardId).toBe('grid-1');
    expect(writes[0].content.connections).toEqual({}); // slot released
    expect(writes[1].cardId).toBe('p1');
    expect(writes[1].content.date).toBeUndefined();
  });

  it('scheduling a linked post moves its slot instead of just writing a date', () => {
    const p = post('p1', '2026-07-10');
    const writes = resolveDateWrites([grid({ 0: 'p1' }), p], p, '2026-07-20');
    expect(writes[0].cardId).toBe('grid-1');
    expect(Object.values(writes[0].content.connections)).toContain('p1');
    expect(writes[1].content.date).toBe('2026-07-20');
  });

  it('an unlinked post is a single content write', () => {
    const p = post('solo', '2026-07-10');
    const writes = resolveDateWrites([p], p, undefined);
    expect(writes).toEqual([{ cardId: 'solo', content: { date: undefined } }]);
  });

  it('keeps the rest of the content and honours a pre-stamped base', () => {
    const p = post('p1', '2026-07-10');
    p.content = { date: '2026-07-10', caption: 'hi' } as any;
    const base = { ...(p.content as any), publishTargets: [{ platform: 'instagram' }] };
    const writes = resolveDateWrites([p], p, '2026-07-11', base);
    expect(writes[0].content).toEqual({ date: '2026-07-11', caption: 'hi', publishTargets: [{ platform: 'instagram' }] });
  });

  it('never touches a grid for a non-linkable card type, and respects a custom date field', () => {
    const story: CardData = { id: 's1', type: CardType.STORY, x: 0, y: 0, width: 10, height: 10, zIndex: 1, content: { date: '2026-07-10' } as any };
    expect(resolveDateWrites([grid({ 0: 's1' }), story], story, undefined)).toHaveLength(1);

    const news: CardData = { id: 'n1', type: CardType.NEWSLETTER, x: 0, y: 0, width: 10, height: 10, zIndex: 1, content: { sendTime: '2026-07-10' } as any };
    const writes = resolveDateWrites([news], news, '2026-07-12', news.content, 'sendTime');
    expect(writes[0].content.sendTime).toBe('2026-07-12');
  });

  it('a card type with no date field produces no writes at all', () => {
    const p = post('p1', '2026-07-10');
    expect(resolveDateWrites([p], p, '2026-07-12', p.content, '')).toEqual([]);
  });
});
