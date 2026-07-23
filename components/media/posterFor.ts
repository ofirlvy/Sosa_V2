import { useEffect, useState } from 'react';
import type { MediaItem } from '../../types';
import { getSessionPoster, ensureSessionPoster } from '../../services/videoPoster';

/**
 * The best still image available for a media item, right now, synchronously:
 * its stored `thumbnail` (new uploads) or a frame captured earlier this session.
 *
 * Used as a `<video poster>` so the mockup shows a real frame instantly instead
 * of an empty gray box while a trailing-moov file downloads in full. Returns
 * undefined when nothing is cached yet — and kicks off a background capture so
 * the next open is instant. Never persists anything.
 */
export const posterFor = (item?: MediaItem): string | undefined => {
  if (!item || item.type !== 'video') return undefined;
  if (item.thumbnail) return item.thumbnail;
  if (!item.url) return undefined;
  const cached = getSessionPoster(item.url);
  if (cached) return cached;
  void ensureSessionPoster(item.url); // warm the cache for next time
  return undefined;
};

/**
 * Reactive form of `posterFor`: re-renders once a capture finishes, so a video
 * uploaded before posters existed still gets a still frame in this session.
 * (`posterFor` alone is read during render and can't announce a late arrival.)
 */
export const usePoster = (item?: MediaItem): string | undefined => {
  const [poster, setPoster] = useState<string | undefined>(() => posterFor(item));
  const url = item?.url;
  const thumb = item?.thumbnail;
  const isVideo = item?.type === 'video';

  useEffect(() => {
    if (!isVideo) { setPoster(undefined); return; }
    if (thumb) { setPoster(thumb); return; }
    setPoster(url ? getSessionPoster(url) : undefined);
    if (!url) return;
    let alive = true;
    ensureSessionPoster(url).then(p => { if (alive && p) setPoster(p); });
    return () => { alive = false; };
  }, [url, thumb, isVideo]);

  return poster;
};
