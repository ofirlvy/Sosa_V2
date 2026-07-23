import { describe, it, expect } from 'vitest';
import { planRatio, DEFAULT_RATIO } from '../components/media/useAssetRatio';
import type { MediaItem } from '../types';

// Why this matters: the Instagram mockup sizes its frame from asset[0]'s ratio.
// Reading that from a <video> takes 1.0-2.4s on the users' files (trailing moov),
// and until it arrives the media is painted cropped into the wrong frame. So the
// order these sources are tried in IS the bug fix.

const video = (over: Partial<MediaItem> = {}): MediaItem => ({ id: 'v', type: 'video', url: 'v.mp4', ...over });
const image = (over: Partial<MediaItem> = {}): MediaItem => ({ id: 'i', type: 'image', url: 'i.png', ...over });

describe('planRatio', () => {
  it('uses an already-measured ratio above everything else — no work, no wait', () => {
    expect(planRatio(video({ thumbnail: 'p.jpg' }), 0.5625)).toEqual({ kind: 'known', ratio: 0.5625 });
    expect(planRatio(image(), 1.5)).toEqual({ kind: 'known', ratio: 1.5 });
  });

  it('measures a video via its poster rather than the video itself', () => {
    // The poster is scaled proportionally from the video, so its ratio is the
    // video's ratio — and an <img> reports it in tens of ms, not seconds.
    expect(planRatio(video({ thumbnail: 'p.jpg' }))).toEqual({ kind: 'image', url: 'p.jpg' });
  });

  it('falls back to capturing the video only when nothing has measured it', () => {
    expect(planRatio(video())).toEqual({ kind: 'capture', url: 'v.mp4' });
  });

  it('measures images directly', () => {
    expect(planRatio(image())).toEqual({ kind: 'image', url: 'i.png' });
  });

  it('gives up cleanly when there is nothing to measure', () => {
    expect(planRatio(undefined)).toEqual({ kind: 'none' });
    expect(planRatio(video({ url: undefined }))).toEqual({ kind: 'none' });
    expect(planRatio(image({ url: undefined }))).toEqual({ kind: 'none' });
  });

  it('ignores a nonsense cached ratio instead of trusting it', () => {
    expect(planRatio(image(), 0)).toEqual({ kind: 'image', url: 'i.png' });
    expect(planRatio(image(), -2)).toEqual({ kind: 'image', url: 'i.png' });
  });

  it('keeps Instagram 4:5 as the placeholder', () => {
    expect(DEFAULT_RATIO).toBeCloseTo(0.8);
  });
});
