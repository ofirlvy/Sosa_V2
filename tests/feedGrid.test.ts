import { describe, it, expect } from 'vitest';
import { computeFeedGrid, TARGET_ASPECT, ASPECT_MIN, ASPECT_MAX, MIN_CELL } from '../services/feedGrid';

// The whole point of this module: the month grid USES the box it is given.
// The version it replaced capped cell width and derived height from width, which
// left a dead strip on the right and another below on a wide screen.

const GAP = 6;
const spanW = (f: { cols: number; cellW: number }) => f.cols * f.cellW + (f.cols - 1) * GAP;
const spanH = (f: { rows: number; cellH: number }) => f.rows * f.cellH + (f.rows - 1) * GAP;

describe('computeFeedGrid — fills the box', () => {
  it('fills BOTH axes exactly on a wide screen (the reported holes)', () => {
    // Roughly the reported layout: ~1280x850 with a month of 16 slots.
    const fit = computeFeedGrid(1280, 850, 16, GAP);
    expect(spanW(fit)).toBeCloseTo(1280, 6);
    expect(spanH(fit)).toBeCloseTo(850, 6);
    expect(fit.scroll).toBe(false);
  });

  it.each([
    ['2 rows', 8],
    ['3 rows', 12],
    ['4 rows', 16],
    ['8 rows', 31],
  ])('fills the full height for %s', (_label, n) => {
    const fit = computeFeedGrid(1200, 800, n, GAP);
    expect(spanW(fit)).toBeCloseTo(1200, 6);
    expect(spanH(fit)).toBeCloseTo(800, 6);
  });

  it('keeps filling when the box narrows (drawer opens) or the screen is huge', () => {
    for (const [w, h] of [[700, 800], [975, 760], [1800, 900], [2400, 1200]]) {
      const fit = computeFeedGrid(w, h, 14, GAP);
      expect(spanW(fit)).toBeCloseTo(w, 6);
      expect(spanH(fit)).toBeCloseTo(h, 6);
    }
  });

  it('never leaves a one-sided hole: any leftover is small enough to centre', () => {
    const fit = computeFeedGrid(1280, 850, 16, GAP);
    expect(1280 - spanW(fit)).toBeLessThan(1);
    expect(850 - spanH(fit)).toBeLessThan(1);
  });
});

describe('computeFeedGrid — still looks like a feed', () => {
  it('picks the column count closest to a 4:5 slot', () => {
    const fit = computeFeedGrid(1280, 850, 16, GAP);
    const aspect = fit.cellW / fit.cellH;
    expect(Math.abs(aspect - TARGET_ASPECT)).toBeLessThan(0.25);
    expect(fit.cols * fit.rows).toBeGreaterThanOrEqual(16);
  });

  it('clamps pathological shapes instead of stretching a slot across the box', () => {
    // One post in a very wide box would otherwise become a 1500x800 landscape tile.
    const fit = computeFeedGrid(1500, 800, 1, GAP);
    const aspect = fit.cellW / fit.cellH;
    expect(aspect).toBeLessThanOrEqual(ASPECT_MAX + 1e-9);
    expect(aspect).toBeGreaterThanOrEqual(ASPECT_MIN - 1e-9);
  });

  it('holds a legible size and asks for scroll rather than shrinking to nothing', () => {
    const fit = computeFeedGrid(300, 200, 31, GAP);
    expect(fit.cellH).toBeGreaterThanOrEqual(MIN_CELL);
    expect(fit.cellW).toBeGreaterThanOrEqual(MIN_CELL);
    expect(fit.scroll).toBe(true);
  });

  it('always covers every slot', () => {
    for (const n of [1, 2, 3, 5, 7, 10, 13, 20, 31]) {
      const fit = computeFeedGrid(1100, 780, n, GAP);
      expect(fit.cols * fit.rows).toBeGreaterThanOrEqual(n);
      expect(fit.rows).toBe(Math.ceil(n / fit.cols));
    }
  });

  it('degrades safely on empty or unmeasured containers', () => {
    expect(computeFeedGrid(0, 0, 0).rows).toBe(0);
    expect(computeFeedGrid(1000, 800, 0).rows).toBe(0);
    expect(computeFeedGrid(0, 800, 5).cellW).toBeGreaterThanOrEqual(0);
    expect(computeFeedGrid(-10, -10, 5).cellW).toBeGreaterThanOrEqual(0);
  });
});
