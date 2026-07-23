import { createLimiter } from './limiter';

// Why this exists (measured against the user's real files, not guessed):
// every video they upload is a QuickTime-brand container whose `moov` atom sits
// at the END of the file. A browser therefore cannot paint a single frame — or
// even report videoWidth/Height — until it has downloaded the WHOLE file (5-12MB).
// So a <video preload="metadata"> used as a thumbnail never reaches `moov` and
// stays blank forever, and one used with autoPlay only appears after a multi-
// second full download.
//
// The fix is to stop asking the video for a still image: capture one frame once
// and show a plain <img> from then on.

/**
 * Which timestamp to grab. 0 often yields a black/blank first frame, so nudge
 * forward — but never past the end of a very short clip.
 */
export const posterSeekTime = (duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0.1;
  return duration < 0.2 ? duration / 2 : 0.1;
};

const POSTER_TIMEOUT_MS = 15000;
const POSTER_MAX_DIM = 640;

/** A captured frame plus the dimensions we had to read to produce it. */
export interface PosterCapture { blob: Blob; width: number; height: number; }

/**
 * Decode one frame of a video into a JPEG blob, and report the video's natural
 * size — we already have to read videoWidth/videoHeight to size the canvas, and
 * that ratio is what mockup frames need (see components/media/useAssetRatio).
 * Returns null on ANY failure (unsupported codec, CORS-tainted canvas, timeout)
 * — a missing poster must never break an upload or a render.
 *
 * @param source a local File (instant: no network) or a URL.
 */
export function captureVideoPoster(source: File | string): Promise<PosterCapture | null> {
  return new Promise(resolve => {
    let settled = false;
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    const src = objectUrl || (source as string);

    const video = document.createElement('video');
    // Needed to read pixels back from a cross-origin (Supabase Storage) video.
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';   // must be 'auto': 'metadata' never reaches a trailing moov
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    const finish = (result: PosterCapture | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = window.setTimeout(() => finish(null), POSTER_TIMEOUT_MS);

    const draw = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, POSTER_MAX_DIM / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => finish(b ? { blob: b, width: w, height: h } : null), 'image/jpeg', 0.8);
      } catch {
        finish(null); // tainted canvas etc.
      }
    };

    video.onloadeddata = () => {
      const target = posterSeekTime(video.duration);
      if (Math.abs(video.currentTime - target) < 0.01) draw();
      else video.currentTime = target;
    };
    video.onseeked = draw;
    video.onerror = () => finish(null);

    video.src = src;
  });
}

// --- Session-only poster cache (NOTHING is persisted) -----------------------
// For videos uploaded before posters existed we must not write to the user's
// saved data, so the generated frame lives in memory for this session only:
// the first view of a legacy video still pays the download, but it resolves to
// a real frame instead of a blank box, and every later render is instant.

const sessionPosters = new Map<string, string>();
/**
 * url -> natural aspect ratio (w/h). Learned for free whenever a poster is
 * captured. Mockup frames need this BEFORE they paint: reading it from the
 * <video> element takes 1-2.4s on these trailing-moov files, which is long
 * enough to show the media cropped to the wrong frame.
 */
const sessionRatios = new Map<string, number>();
const inFlight = new Map<string, Promise<string | undefined>>();
const posterLimiter = createLimiter(2); // decoding video is expensive — throttle

/** A cached poster for this URL, if one was already produced this session. */
export const getSessionPoster = (url: string): string | undefined =>
  url ? sessionPosters.get(url) : undefined;

/** A known aspect ratio (w/h) for this URL, if anything has measured it. */
export const getSessionRatio = (url?: string): number | undefined =>
  url ? sessionRatios.get(url) : undefined;

/** Record a ratio learned elsewhere (e.g. a <video> that finally loaded). */
export const rememberAspect = (url: string | undefined, ratio: number): void => {
  if (url && Number.isFinite(ratio) && ratio > 0) sessionRatios.set(url, ratio);
};
export const rememberRatio = (url: string | undefined, w: number, h: number): void => {
  if (w > 0 && h > 0) rememberAspect(url, w / h);
};

/**
 * Produce (once) and cache a poster for a URL that has no stored thumbnail.
 * Concurrent callers for the same URL share one capture.
 */
export function ensureSessionPoster(url: string): Promise<string | undefined> {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return Promise.resolve(undefined);
  const cached = sessionPosters.get(url);
  if (cached) return Promise.resolve(cached);
  const running = inFlight.get(url);
  if (running) return running;

  const task = posterLimiter(() => captureVideoPoster(url))
    .then(cap => {
      if (!cap) return undefined;
      rememberRatio(url, cap.width, cap.height);
      const objectUrl = URL.createObjectURL(cap.blob);
      sessionPosters.set(url, objectUrl);
      return objectUrl;
    })
    .catch(() => undefined)
    .finally(() => { inFlight.delete(url); });

  inFlight.set(url, task);
  return task;
}

/** Test seam: drop the in-memory cache. */
export const __clearSessionPosters = () => {
  sessionPosters.forEach(u => { try { URL.revokeObjectURL(u); } catch { /* noop */ } });
  sessionPosters.clear();
  sessionRatios.clear();
  inFlight.clear();
};
