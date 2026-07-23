import { describe, it, expect } from 'vitest';
import { toLocal, localToWorld, worldToLocal, screenToWorld } from '../services/coords';

// Offset-aware canvas coordinates. When the board shrinks into an offset "window"
// (chat drawer open), client→world must subtract the container origin. A broken
// transform silently drops pasted/selected content in the wrong place.

const pan = { x: 120, y: 40 };
const scale = 1.5;
const rect = { left: 400, top: 24 }; // container offset (drawer open)

describe('coords round-trips', () => {
  it('localToWorld ∘ worldToLocal is identity', () => {
    const w = { x: 37.5, y: -12.25 };
    const local = worldToLocal(w.x, w.y, pan, scale);
    const back = localToWorld(local.x, local.y, pan, scale);
    expect(back.x).toBeCloseTo(w.x, 9);
    expect(back.y).toBeCloseTo(w.y, 9);
  });

  it('screenToWorld accounts for the container offset (windowed board)', () => {
    // With offset, a click at client (400,24) == container-local (0,0).
    const atOrigin = screenToWorld(rect.left, rect.top, rect, pan, scale);
    const localOrigin = localToWorld(0, 0, pan, scale);
    expect(atOrigin).toEqual(localOrigin);
  });

  it('client → world → local(+offset) recovers the original client point', () => {
    const clientX = 733, clientY = 210;
    const world = screenToWorld(clientX, clientY, rect, pan, scale);
    const local = worldToLocal(world.x, world.y, pan, scale);
    expect(local.x + rect.left).toBeCloseTo(clientX, 9);
    expect(local.y + rect.top).toBeCloseTo(clientY, 9);
  });

  it('no offset (drawer closed) behaves as plain screen→world', () => {
    expect(toLocal(50, 60, null)).toEqual({ x: 50, y: 60 });
    expect(screenToWorld(50, 60, undefined, pan, scale)).toEqual(localToWorld(50, 60, pan, scale));
  });
});
