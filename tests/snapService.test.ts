import { describe, it, expect } from 'vitest';
import { computeSnap, Rect } from '../services/snapService';

// Magnetic alignment snapping: nudge within threshold, never beyond.

const r = (x: number, y: number, width = 100, height = 100): Rect => ({ x, y, width, height });

describe('computeSnap', () => {
  it('snaps left edges together when within threshold', () => {
    // moving.left = 103, other.left = 100 → within 8 → snap dx = -3
    const res = computeSnap(r(103, 300), [r(100, 0)], 8);
    expect(res.dx).toBe(-3);
    expect(res.guides.some(g => g.orientation === 'v')).toBe(true);
  });

  it('does NOT snap when beyond threshold', () => {
    const res = computeSnap(r(140, 300), [r(100, 0)], 8);
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
    expect(res.guides).toHaveLength(0);
  });

  it('snaps centers on both axes independently', () => {
    // moving center (x): 200+ ... align centerX to other centerX
    const moving = r(146, 146); // center (196,196)
    const other = r(150, 150);  // center (200,200)
    const res = computeSnap(moving, [other], 8);
    expect(res.dx).toBe(4); // 196 → 200
    expect(res.dy).toBe(4);
  });
});
