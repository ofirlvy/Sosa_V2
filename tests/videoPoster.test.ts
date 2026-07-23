import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { posterSeekTime } from '../services/videoPoster';

// Video thumbnails exist because the user's files are QuickTime containers with
// a trailing `moov` atom: a browser can't paint a frame until the whole file has
// downloaded, so a <video> used as a thumbnail stays blank. These pin the two
// pieces of that machinery that are testable without a real decoder.

describe('posterSeekTime', () => {
  it('nudges past 0 so the frame is not the usual black first frame', () => {
    expect(posterSeekTime(10)).toBe(0.1);
    expect(posterSeekTime(0.2)).toBe(0.1);
  });

  it('never seeks past the end of a very short clip', () => {
    expect(posterSeekTime(0.1)).toBeCloseTo(0.05);
    expect(posterSeekTime(0.02)).toBeCloseTo(0.01);
  });

  it('falls back safely when duration is unknown (NaN/Infinity/0)', () => {
    expect(posterSeekTime(NaN)).toBe(0.1);
    expect(posterSeekTime(Infinity)).toBe(0.1);
    expect(posterSeekTime(0)).toBe(0.1);
    expect(posterSeekTime(-5)).toBe(0.1);
  });
});

// The session cache must never write to user data and must capture each URL at
// most once, however many components render the same video.
describe('session poster cache', () => {
  let created = 0;

  beforeEach(() => {
    vi.resetModules();
    created = 0;
    (globalThis as any).URL.createObjectURL = vi.fn(() => `blob:poster-${++created}`);
    (globalThis as any).URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  const loadWithStubbedCapture = async () => {
    const captures: string[] = [];
    vi.doMock('../services/videoPoster', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../services/videoPoster')>();
      return actual;
    });
    // Stub the DOM pieces captureVideoPoster needs so it resolves deterministically.
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'video') {
          const el: any = {};
          captures.push('video');
          Object.defineProperty(el, 'src', {
            set() { setTimeout(() => { el.videoWidth = 100; el.videoHeight = 200; el.duration = 5; el.onloadeddata?.(); }, 0); },
            get() { return ''; },
          });
          el.removeAttribute = () => {};
          el.load = () => {};
          let t = 0;
          Object.defineProperty(el, 'currentTime', {
            set(v: number) { t = v; setTimeout(() => el.onseeked?.(), 0); },
            get() { return t; },
          });
          return el;
        }
        return {
          width: 0, height: 0,
          getContext: () => ({ drawImage: () => {} }),
          toBlob: (cb: (b: any) => void) => cb({ size: 10, type: 'image/jpeg' }),
        };
      },
    };
    (globalThis as any).window = {
      setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: any) => clearTimeout(id),
    };
    const mod = await import('../services/videoPoster');
    return { mod, captures };
  };

  it('captures a URL once and serves the cached poster afterwards', async () => {
    const { mod, captures } = await loadWithStubbedCapture();
    const url = 'https://x/storage/v1/object/public/media/a.mp4';

    const [a, b] = await Promise.all([mod.ensureSessionPoster(url), mod.ensureSessionPoster(url)]);
    expect(a).toBe(b);                       // concurrent callers share one capture
    expect(captures).toHaveLength(1);

    expect(mod.getSessionPoster(url)).toBe(a); // later renders are instant
    await mod.ensureSessionPoster(url);
    expect(captures).toHaveLength(1);          // still only one decode
  });

  it('refuses transient sources — a blob:/data: URL is never worth caching', async () => {
    const { mod, captures } = await loadWithStubbedCapture();
    expect(await mod.ensureSessionPoster('blob:local-preview')).toBeUndefined();
    expect(await mod.ensureSessionPoster('data:video/mp4;base64,AAA')).toBeUndefined();
    expect(await mod.ensureSessionPoster('')).toBeUndefined();
    expect(captures).toHaveLength(0);
  });
});
