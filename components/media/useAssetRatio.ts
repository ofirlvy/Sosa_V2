import { useEffect, useState } from 'react';
import type { MediaItem } from '../../types';
import { getSessionRatio, ensureSessionPoster, rememberRatio, rememberAspect } from '../../services/videoPoster';

/** Instagram's default frame until anything better is known. */
export const DEFAULT_RATIO = 4 / 5;

export type RatioPlan =
  | { kind: 'known'; ratio: number }
  /** Measure this URL with an <img> — fast (tens of ms). */
  | { kind: 'image'; url: string }
  /** Only the video itself knows: capture it (slow, seconds). */
  | { kind: 'capture'; url: string }
  | { kind: 'none' };

/**
 * Where to get an asset's aspect ratio from, cheapest source first.
 *
 * This exists because reading `videoWidth` off a <video> takes 1.0-2.4s for the
 * files users upload (QuickTime containers with a trailing moov atom — see
 * services/videoPoster). The mockup frame is sized from this ratio, so waiting
 * means the media is briefly painted cropped into the WRONG frame.
 * A poster JPEG is scaled proportionally from the video, so its ratio is the
 * video's ratio — and an <img> reports it almost immediately.
 */
export const planRatio = (item: MediaItem | undefined, sessionRatio?: number): RatioPlan => {
  if (!item) return { kind: 'none' };
  if (sessionRatio && sessionRatio > 0) return { kind: 'known', ratio: sessionRatio };
  if (item.type === 'video') {
    // A session poster always comes with a session ratio, so reaching here with
    // no stored thumbnail means nothing has measured this video yet.
    if (item.thumbnail) return { kind: 'image', url: item.thumbnail };
    return item.url ? { kind: 'capture', url: item.url } : { kind: 'none' };
  }
  return item.url ? { kind: 'image', url: item.url } : { kind: 'none' };
};

/**
 * The best aspect ratio known for an asset right now, improving as better
 * sources resolve. `report` lets a rendered element hand over the authoritative
 * value once it finally has it (e.g. the visible <video>'s metadata).
 */
export function useAssetRatio(item?: MediaItem): {
  ratio: number;
  /** Report from natural pixel dimensions (an <img>). */
  report: (w: number, h: number) => void;
  /** Report an already-computed ratio (MockupVideo's onAspect). */
  reportRatio: (ratio: number) => void;
} {
  const [ratio, setRatio] = useState<number | undefined>(() => getSessionRatio(item?.url));

  const reportRatio = (r: number) => {
    if (!(Number.isFinite(r) && r > 0)) return;
    rememberAspect(item?.url, r);
    setRatio(r);
  };
  const report = (w: number, h: number) => {
    if (w > 0 && h > 0) reportRatio(w / h);
  };

  const url = item?.url;
  const thumb = item?.thumbnail;
  const type = item?.type;

  useEffect(() => {
    let alive = true;
    const known = getSessionRatio(url);
    setRatio(known);

    const plan = planRatio(item, known);
    if (plan.kind === 'known' || plan.kind === 'none') return;

    if (plan.kind === 'image') {
      const img = new Image();
      img.onload = () => {
        if (!alive || !img.naturalWidth || !img.naturalHeight) return;
        rememberRatio(url, img.naturalWidth, img.naturalHeight);
        setRatio(img.naturalWidth / img.naturalHeight);
      };
      img.src = plan.url;
      return () => { alive = false; };
    }

    // Video with nothing measured yet: the capture reads the real dimensions and
    // records them, so this both warms the poster and settles the ratio.
    ensureSessionPoster(plan.url).then(() => {
      const learned = getSessionRatio(plan.url);
      if (alive && learned) setRatio(learned);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, thumb, type]);

  return { ratio: ratio ?? DEFAULT_RATIO, report, reportRatio };
}
