import { describe, it, expect } from 'vitest';
import { CardData, CardType, FileSystemNode, PublishTarget } from '../types';
import { collectQueue, dueTargets, markTargetsNeedAction, setTargetStatus } from '../services/publishReminders';

// Publishing-queue invariants: due selection must never fire early, re-fire
// announced items, or resurrect published/canceled ones — otherwise the user
// gets phantom reminders or silently missed publishes.

const target = (id: string, at: string, status: PublishTarget['status'] = 'scheduled'): PublishTarget =>
  ({ id, platform: 'instagram', at, status });

const post = (id: string, targets: PublishTarget[]): CardData => ({
  id, type: CardType.POST, x: 0, y: 0, width: 300, height: 400, zIndex: 1,
  content: { title: id, publishTargets: targets } as any,
});

const board = (cards: CardData[]): Record<string, FileSystemNode> => ({
  wb1: { id: 'wb1', type: 'whiteboard', name: 'B', parentId: null, whiteboardData: [{ id: 'tab-1', name: 'S', cards }] } as FileSystemNode,
});

const T0 = Date.parse('2026-07-04T12:00:00Z');

describe('collectQueue / dueTargets', () => {
  it('collects targets across boards sorted by time', () => {
    const nodes = board([
      post('p1', [target('t1', '2026-07-04T13:00:00Z')]),
      post('p2', [target('t2', '2026-07-04T11:00:00Z')]),
    ]);
    const q = collectQueue(nodes);
    expect(q.map(i => i.target.id)).toEqual(['t2', 't1']);
    expect(q[0].nodeId).toBe('wb1');
  });

  it('due = scheduled AND time arrived; future/announced/done are excluded', () => {
    const q = collectQueue(board([post('p', [
      target('past', '2026-07-04T11:59:00Z'),
      target('future', '2026-07-04T12:01:00Z'),
      target('announced', '2026-07-04T10:00:00Z', 'needs_action'),
      target('done', '2026-07-04T09:00:00Z', 'published'),
      target('off', '2026-07-04T08:00:00Z', 'canceled'),
    ])]));
    expect(dueTargets(q, T0).map(i => i.target.id)).toEqual(['past']);
  });
});

describe('status transitions (pure content updates)', () => {
  const content = { title: 'x', publishTargets: [target('a', '2026-07-04T10:00:00Z'), target('b', '2026-07-04T11:00:00Z')] };

  it('markTargetsNeedAction flips only the given ids', () => {
    const next = markTargetsNeedAction(content, ['a']);
    expect(next.publishTargets[0].status).toBe('needs_action');
    expect(next.publishTargets[1].status).toBe('scheduled');
    expect(content.publishTargets[0].status).toBe('scheduled'); // no mutation
  });

  it('setTargetStatus published stamps publishedAt', () => {
    const next = setTargetStatus(content, 'b', 'published');
    expect(next.publishTargets[1].status).toBe('published');
    expect(typeof next.publishTargets[1].publishedAt).toBe('string');
    expect(next.publishTargets[0]).toEqual(content.publishTargets[0]);
  });
});
