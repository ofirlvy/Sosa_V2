// Pure canvas coordinate math. Extracted from Canvas.tsx so the offset-aware
// transforms are unit-testable (the board can be pushed into an offset "window"
// when the chat drawer is open — see memory board_chat_drawer). Kept side-effect
// free: callers pass the container rect / pan / scale explicitly.

export interface Vec { x: number; y: number }
export interface RectOffset { left: number; top: number }

/** client (viewport) coords → container-local coords. */
export const toLocal = (clientX: number, clientY: number, rect?: RectOffset | null): Vec => ({
  x: clientX - (rect?.left ?? 0),
  y: clientY - (rect?.top ?? 0),
});

/** container-local coords → world coords. */
export const localToWorld = (lx: number, ly: number, pan: Vec, scale: number): Vec => ({
  x: (lx - pan.x) / scale,
  y: (ly - pan.y) / scale,
});

/** world coords → container-local coords (inverse of localToWorld). */
export const worldToLocal = (wx: number, wy: number, pan: Vec, scale: number): Vec => ({
  x: wx * scale + pan.x,
  y: wy * scale + pan.y,
});

/** client (viewport) coords → world coords (offset-safe). */
export const screenToWorld = (clientX: number, clientY: number, rect: RectOffset | null | undefined, pan: Vec, scale: number): Vec => {
  const p = toLocal(clientX, clientY, rect);
  return localToWorld(p.x, p.y, pan, scale);
};
