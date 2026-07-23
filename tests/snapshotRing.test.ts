import { describe, it, expect } from 'vitest';
import { pushSnapshot, MAX_SNAPSHOTS, Snapshot } from '../services/snapshotRing';

// The local data-history net: bounded, deduped, never snapshots a wipe.

const snap = (n: number): string => JSON.stringify({ ['n' + n]: { type: 'folder', name: 'x' } });

describe('pushSnapshot', () => {
  it('appends a new snapshot (oldest-first)', () => {
    const r1 = pushSnapshot([], snap(1), 100);
    const r2 = pushSnapshot(r1, snap(2), 200);
    expect(r2.map(s => s.ts)).toEqual([100, 200]);
  });

  it('dedups against the newest entry (no snapshot when unchanged) — same ref back', () => {
    const r1 = pushSnapshot([], snap(1), 100);
    const r2 = pushSnapshot(r1, snap(1), 200);
    expect(r2).toBe(r1); // unchanged reference → caller skips the write
  });

  it('never snapshots an empty / {} tree (guards a wipe)', () => {
    expect(pushSnapshot([], '', 1)).toEqual([]);
    expect(pushSnapshot([], '{}', 1)).toEqual([]);
  });

  it('bounds to the most recent MAX_SNAPSHOTS', () => {
    let ring: Snapshot[] = [];
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) ring = pushSnapshot(ring, snap(i), i);
    expect(ring.length).toBe(MAX_SNAPSHOTS);
    // oldest dropped, newest kept
    expect(ring[0].ts).toBe(5);
    expect(ring[ring.length - 1].ts).toBe(MAX_SNAPSHOTS + 4);
  });
});
