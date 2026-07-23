import { describe, it, expect } from 'vitest';
import { tileGrid } from '../services/mediaLayout';

// Multi-media drop layout: a centered non-overlapping grid.
describe('tileGrid', () => {
  it('returns one centered tile for n=1', () => {
    const [p] = tileGrid(1, 260, 28, 100, 100);
    expect(p).toEqual({ x: 100 - 130, y: 100 - 130 });
  });

  it('lays 4 tiles in a 2×2 grid, no overlap, centered', () => {
    const pts = tileGrid(4, 260, 28, 0, 0);
    expect(pts).toHaveLength(4);
    const step = 260 + 28;
    // cols=2 → total width = 2*260+28 = 548, start = -274
    expect(pts[0]).toEqual({ x: -274, y: -274 });
    expect(pts[1]).toEqual({ x: -274 + step, y: -274 });
    expect(pts[2]).toEqual({ x: -274, y: -274 + step });
    // adjacent tiles are exactly cell+gap apart → gap between edges = 28 (no overlap)
    expect(pts[1].x - pts[0].x).toBe(step);
  });

  it('n=5 → 3 cols × 2 rows', () => {
    const pts = tileGrid(5, 100, 10, 0, 0);
    expect(pts).toHaveLength(5);
    // row breaks at index 3
    expect(pts[3].y).toBeGreaterThan(pts[2].y);
    expect(pts[3].x).toBe(pts[0].x);
  });

  it('returns empty for n<=0', () => {
    expect(tileGrid(0, 260, 28, 0, 0)).toEqual([]);
  });
});
