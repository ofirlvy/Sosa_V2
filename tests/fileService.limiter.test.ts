import { describe, it, expect } from 'vitest';
import { createLimiter } from '../services/fileService';

// The media-upload throttle: never more than `max` tasks in flight, and every
// task still runs and resolves in order of completion.
describe('createLimiter', () => {
  it('never exceeds the concurrency cap and resolves all tasks', async () => {
    const run = createLimiter(3);
    let active = 0;
    let peak = 0;
    const results: number[] = [];
    const mkTask = (i: number) => run(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      results.push(i);
      return i;
    });
    const out = await Promise.all(Array.from({ length: 10 }, (_, i) => mkTask(i)));
    expect(peak).toBeLessThanOrEqual(3);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results).toHaveLength(10);
  });

  it('propagates rejection without stalling the queue', async () => {
    const run = createLimiter(1);
    const a = run(async () => { throw new Error('boom'); });
    const b = run(async () => 'ok');
    await expect(a).rejects.toThrow('boom');
    await expect(b).resolves.toBe('ok');
  });
});
