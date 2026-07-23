import { ConnectorRouting } from '../types';

// Pure geometry helpers for drawing connectors between element rectangles.
// Endpoints are derived from current positions at render time → arrows auto-reroute.

export interface Rect { x: number; y: number; width: number; height: number; }
export interface Pt { x: number; y: number; }

export const rectCenter = (r: Rect): Pt => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
export const midPoint = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// The point on rect `r`'s border along the ray from its center toward `to`.
export function edgePoint(r: Rect, to: Pt): Pt {
  const c = rectCenter(r);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = r.width / 2;
  const hh = r.height / 2;
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

// The two anchor points (on each rect's border, facing each other).
export function anchors(a: Rect, b: Rect): { from: Pt; to: Pt } {
  return { from: edgePoint(a, rectCenter(b)), to: edgePoint(b, rectCenter(a)) };
}

// SVG path string for the chosen routing.
export function connectorPath(routing: ConnectorRouting | undefined, a: Pt, b: Pt): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (routing === 'straight') return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (routing === 'orthogonal') {
    if (Math.abs(dx) >= Math.abs(dy)) {
      const mx = a.x + dx / 2;
      return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
    }
    const my = a.y + dy / 2;
    return `M ${a.x} ${a.y} L ${a.x} ${my} L ${b.x} ${my} L ${b.x} ${b.y}`;
  }
  // bezier (default) — S-curve biased along the dominant axis.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return `M ${a.x} ${a.y} C ${a.x + dx * 0.5} ${a.y}, ${b.x - dx * 0.5} ${b.y}, ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy * 0.5}, ${b.x} ${b.y - dy * 0.5}, ${b.x} ${b.y}`;
}

export const dashArrayFor = (style?: string): string | undefined =>
  style === 'dashed' ? '9 7' : style === 'dotted' ? '1 7' : undefined;

export const DEFAULT_CONNECTOR_COLOR = '#5F2427';
