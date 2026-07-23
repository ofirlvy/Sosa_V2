// Layout maths for the Feed page's slot grid.
//
// The rule: the grid FILLS its box on both axes. The previous version derived
// cell height from width (fixed 4:5) and capped the width, so a wide screen left
// a strip of dead space on the right AND below — the grid visibly failed to use
// the room it had.

/** Instagram's portrait post ratio — what a slot wants to look like. */
export const TARGET_ASPECT = 4 / 5;
/** A slot never becomes landscape-wide, nor thinner than 1:2. */
export const ASPECT_MIN = 0.5;
export const ASPECT_MAX = 1.0;
/** Below this a slot is too small to read; scroll instead of shrinking further. */
export const MIN_CELL = 44;

export interface FeedGridFit {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** True when the month can't fit at a legible size and the area must scroll. */
  scroll: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fit `n` slots into a `w`×`h` box.
 *
 * Every candidate column count is measured by filling BOTH axes exactly, and the
 * winner is whichever lands closest to a 4:5 slot — so the grid always uses the
 * whole box while still looking like a feed. Two rows fill the height just as
 * completely as eight do.
 *
 * Any leftover (only when the aspect clamp bites, e.g. a single post in a huge
 * box) is centred by the caller, so it never reads as a hole on one side.
 */
export function computeFeedGrid(w: number, h: number, n: number, gap = 6): FeedGridFit {
  if (n <= 0 || w <= 0 || h <= 0) {
    return { cols: 1, rows: 0, cellW: 0, cellH: 0, scroll: false };
  }

  let best: FeedGridFit & { err: number } | null = null;

  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (w - (cols - 1) * gap) / cols;
    const cellH = (h - (rows - 1) * gap) / rows;
    if (cellW <= 0) continue;

    // How far this arrangement sits from a post-shaped slot.
    const aspect = cellH > 0 ? cellW / cellH : Infinity;
    const err = Math.abs(clamp(aspect, ASPECT_MIN, ASPECT_MAX) - TARGET_ASPECT)
      // Penalise arrangements that need clamping — they can't fill both axes.
      + Math.abs(aspect - clamp(aspect, ASPECT_MIN, ASPECT_MAX));

    if (!best || err < best.err) best = { cols, rows, cellW, cellH, scroll: false, err };
  }

  if (!best) return { cols: 1, rows: n, cellW: Math.max(w, MIN_CELL), cellH: MIN_CELL, scroll: true };

  const { cols, rows } = best;
  let { cellW, cellH } = best;

  // Keep the slot post-shaped: shrink the over-long axis, never stretch.
  const aspect = cellW / cellH;
  if (aspect > ASPECT_MAX) cellW = cellH * ASPECT_MAX;
  else if (aspect < ASPECT_MIN) cellH = cellW / ASPECT_MIN;

  // Too tight to read → hold a legible size and let the area scroll.
  let scroll = false;
  if (cellH < MIN_CELL) {
    cellH = MIN_CELL;
    cellW = Math.min(cellW, cellH * ASPECT_MAX);
    scroll = true;
  }
  if (cellW < MIN_CELL) {
    cellW = MIN_CELL;
    scroll = true;
  }

  return { cols, rows, cellW, cellH, scroll };
}
