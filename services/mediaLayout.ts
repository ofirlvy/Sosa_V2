// Layout for dropping/pasting several media files at once: a centered grid so
// the new cards tile neatly instead of stacking on top of each other.

export interface Point { x: number; y: number; }

/**
 * Top-left positions for `n` equal `cell`-sized tiles laid out in a near-square
 * grid (cols = ceil(sqrt(n))), separated by `gap`, centered on (cx, cy).
 */
export const tileGrid = (n: number, cell: number, gap: number, cx: number, cy: number): Point[] => {
  if (n <= 0) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const step = cell + gap;
  const totalW = cols * cell + (cols - 1) * gap;
  const totalH = rows * cell + (rows - 1) * gap;
  const startX = cx - totalW / 2;
  const startY = cy - totalH / 2;
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    points.push({ x: startX + col * step, y: startY + row * step });
  }
  return points;
};
