// Persistence-safe file handling.
//
// Pasted/uploaded files must be stored as base64 data URLs (not blob: object
// URLs), because blob URLs die when the tab closes and the saved workspace
// would then point at a dead reference. base64 lives inside the saved data, so
// it survives refresh — at the cost of localStorage quota, hence the size guard.

import { uploadMedia } from './supabase';
import { captureVideoPoster } from './videoPoster';
import { createLimiter } from './limiter';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB (legacy base64 guard)
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024; // 100MB — Storage-backed uploads

/** Convert a File/Blob into a persistable base64 data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** True when the file is small enough to safely embed as base64. */
export function isWithinSizeLimit(file: File): boolean {
  return file.size <= MAX_IMAGE_BYTES;
}

export function sizeLimitMessage(): string {
  return `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB). Please use a smaller file.`;
}

/** True when the file is within the Storage-backed upload cap. */
export function isWithinMediaLimit(file: File): boolean {
  return file.size <= MAX_MEDIA_BYTES;
}

export function mediaLimitMessage(): string {
  return `File is too large (max ${Math.round(MAX_MEDIA_BYTES / (1024 * 1024))}MB). Please use a smaller file.`;
}

/**
 * May a failed upload fall back to an inline base64 data URL?
 * ONLY for genuinely small files. The whole node tree is ONE JSON blob, so
 * inlining a large asset (a 100MB video ≈ 133MB of base64) makes every
 * subsequent save fail — losing far more than the single asset.
 */
export const canInlineAsBase64 = (bytes: number): boolean => bytes <= MAX_IMAGE_BYTES;

/**
 * Downscale + re-encode large images before upload so a 6MB photo becomes a few
 * hundred KB — uploads in ~1s instead of tens of seconds. Returns the original
 * file unchanged for video, GIFs, SVGs, or when compression wouldn't help.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  const MAX_DIM = 1920;
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    // Skip work if it's already small enough and not huge on disk.
    if (scale === 1 && file.size <= 1_000_000) return file;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const mime = hasAlpha ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, mime, 0.85));
    if (!blob || blob.size >= file.size) return file; // no win → keep original
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: mime });
  } catch {
    return file; // any failure → upload the original
  }
}

/**
 * Persist a media file and return a URL to store in card content.
 * Compresses images, uploads to Supabase Storage (keeps the JSON blob small,
 * supports large video); on any failure falls back to an inline base64 data URL
 * so the asset is never lost.
 */
export async function persistMedia(file: File): Promise<string> {
  const optimized = await compressImage(file).catch(() => file);

  // Retry the upload — big files on flaky networks fail transiently, and losing a
  // 100MB video to one blip is unacceptable.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await uploadMedia(optimized);
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  // Base64 fallback ONLY for genuinely small files. Inlining a large asset would
  // bloat the single file_system JSON blob (a 100MB video ≈ 133MB of base64),
  // which makes EVERY subsequent save fail — losing far more than one asset.
  if (canInlineAsBase64(optimized.size)) {
    console.error('Storage upload failed — falling back to base64 (small file)', lastErr);
    return await fileToDataUrl(optimized);
  }
  console.error('Storage upload failed for a large file — surfacing to the caller', lastErr);
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}

// Re-exported for existing importers (tests + callers use fileService).
export { createLimiter };

// Global media-upload throttle: instant previews, but persist a few at a time.
const mediaLimiter = createLimiter(3);

/**
 * Optimistic upload: returns an INSTANT local preview URL (objectURL) plus a
 * promise that resolves to the persisted Storage URL. Callers should insert the
 * card/MediaItem immediately with `previewUrl`, then swap to the resolved URL and
 * call `URL.revokeObjectURL(previewUrl)`. Never persist `previewUrl` (it's a
 * blob: URL that dies on reload — stripBlobUrls guards the save path).
 * The persist runs through a concurrency limiter so many simultaneous drops
 * don't block the main thread and delay the previews.
 */
export function beginMediaUpload(file: File): {
  previewUrl: string;
  promise: Promise<string>;
  /** For video: a persisted poster frame (or undefined). Never rejects. */
  posterPromise: Promise<string | undefined>;
} {
  activeUploads++;
  const promise = mediaLimiter(() => persistMedia(file)).finally(() => { activeUploads--; });

  // Capture the poster from the LOCAL file (instant — no network) so a video has
  // a real still image the moment it's saved. Without one, every thumbnail has to
  // download the whole video before it can paint a frame; see services/videoPoster.
  const posterPromise: Promise<string | undefined> = file.type.startsWith('video')
    ? captureVideoPoster(file)
        .then(cap => {
          if (!cap) return undefined;
          const posterFile = new File([cap.blob], file.name.replace(/\.[^.]+$/, '') + '-poster.jpg', { type: 'image/jpeg' });
          return mediaLimiter(() => uploadMedia(posterFile)).catch(() => undefined);
        })
        .catch(() => undefined)
    : Promise.resolve(undefined);

  return { previewUrl: URL.createObjectURL(file), promise, posterPromise };
}

// How many uploads are still in flight — used to warn before closing the tab, so
// a heavy video isn't abandoned mid-upload (which would persist an empty URL).
let activeUploads = 0;
export const pendingUploadCount = () => activeUploads;

/**
 * Deep-clone a value for persistence: a transient `blob:` preview (an upload
 * still in flight) must never be written to the DB/cache, because it dies with
 * the tab. Any object whose `url` was a live blob is additionally marked
 * `uploadPending: true`, so a card whose upload didn't finish renders an explicit
 * "upload didn't complete" state instead of a permanently black/broken player.
 * Once the real Storage URL lands, the flag is cleared on the next save.
 */
export function stripBlobUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.startsWith('blob:') ? '' : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(stripBlobUrls) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    let pending = false;
    for (const [k, v] of Object.entries(value)) {
      if (k === 'url' && typeof v === 'string' && v.startsWith('blob:')) {
        out[k] = '';
        pending = true;
        continue;
      }
      out[k] = stripBlobUrls(v as any);
    }
    if (pending) out.uploadPending = true;
    else if (typeof out.url === 'string' && out.url) delete out.uploadPending; // real URL landed
    return out;
  }
  return value;
}
