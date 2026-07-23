import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';

/**
 * Optimistic media upload for the phone-mockup editors: emits an instant local
 * preview URL, then the persisted Storage URL when the upload lands. Identical
 * to the brand-avatar flow in Sidebar.tsx — a Storage URL is stored, NEVER
 * base64 (the whole tree is one JSON blob; see persistence invariant #10).
 *
 * @returns false when the file was rejected by the size guard.
 */
export const uploadOptimistic = (
  file: File,
  onUrl: (url: string) => void,
  onPoster?: (thumbnail: string) => void,
): boolean => {
  if (!isWithinMediaLimit(file)) { alert(mediaLimitMessage()); return false; }
  const { previewUrl, promise, posterPromise } = beginMediaUpload(file);
  onUrl(previewUrl);
  promise.then(onUrl).catch(() => { /* keep the preview; the card shows its own pending state */ });
  // Video poster (see services/videoPoster) — resolves separately from the upload.
  if (onPoster) posterPromise.then(t => { if (t) onPoster(t); });
  return true;
};

export const mediaKind = (file: File): 'image' | 'video' =>
  file.type.startsWith('video') ? 'video' : 'image';

export const newId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
