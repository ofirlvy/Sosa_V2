// Figma/Illustrator-style magnetic snapping for card drags. Pure math: given
// the moving selection's bounding box and the other cards' rects, nudge dx/dy
// so edges/centers align when within a (screen-px) threshold, and return the
// guide lines to draw.

export interface Rect { x: number; y: number; width: number; height: number }

export interface SnapGuide {
  orientation: 'v' | 'h';
  /** World coordinate of the line (x for vertical, y for horizontal). */
  position: number;
  /** Extent of the line along the other axis (world coords). */
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

const edgesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const edgesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

/**
 * @param moving   bounding box of the dragged set at its RAW (unsnapped) position
 * @param others   rects of stationary cards to snap against
 * @param threshold max distance (world units) to magnetize
 */
export const computeSnap = (moving: Rect, others: Rect[], threshold: number): SnapResult => {
  let bestX: { dist: number; delta: number; other: Rect; position: number } | null = null;
  let bestY: { dist: number; delta: number; other: Rect; position: number } | null = null;

  const mx = edgesX(moving);
  const my = edgesY(moving);

  for (const o of others) {
    for (const oe of edgesX(o)) {
      for (const me of mx) {
        const dist = Math.abs(oe - me);
        if (dist <= threshold && (!bestX || dist < bestX.dist)) {
          bestX = { dist, delta: oe - me, other: o, position: oe };
        }
      }
    }
    for (const oe of edgesY(o)) {
      for (const me of my) {
        const dist = Math.abs(oe - me);
        if (dist <= threshold && (!bestY || dist < bestY.dist)) {
          bestY = { dist, delta: oe - me, other: o, position: oe };
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (bestX) {
    const movedTop = moving.y + (bestY?.delta || 0);
    guides.push({
      orientation: 'v',
      position: bestX.position,
      from: Math.min(movedTop, bestX.other.y),
      to: Math.max(movedTop + moving.height, bestX.other.y + bestX.other.height),
    });
  }
  if (bestY) {
    const movedLeft = moving.x + (bestX?.delta || 0);
    guides.push({
      orientation: 'h',
      position: bestY.position,
      from: Math.min(movedLeft, bestY.other.x),
      to: Math.max(movedLeft + moving.width, bestY.other.x + bestY.other.width),
    });
  }

  return { dx: bestX?.delta || 0, dy: bestY?.delta || 0, guides };
};
