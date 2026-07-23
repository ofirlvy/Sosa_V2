import React, { useEffect, useState } from 'react';
import { getSessionPoster, ensureSessionPoster } from '../../services/videoPoster';

/**
 * The ONE way to show a still image for a video anywhere in the app.
 *
 * Why it exists: the user's videos are QuickTime containers whose `moov` atom is
 * at the end of the file, so a plain `<video preload="metadata">` never loads far
 * enough to paint a frame — it stays a blank box forever. (See services/videoPoster.)
 *
 * Order of preference:
 *  1. a stored `thumbnail` (new uploads) → a plain <img>: instant, no video fetch
 *  2. a poster captured earlier this session → instant
 *  3. the video itself with `#t=0.1`, while a poster is captured in the background
 *     so it resolves to a real frame and stays instant for the rest of the session
 *
 * Nothing here writes to the user's saved data.
 */
export const VideoThumb: React.FC<{
  url?: string;
  /** Persisted poster frame, when the video was uploaded with one. */
  thumbnail?: string;
  className?: string;
  /** Skip the background capture for tiny/offscreen thumbs if ever needed. */
  capture?: boolean;
}> = ({ url, thumbnail, className = 'w-full h-full object-cover', capture = true }) => {
  const [poster, setPoster] = useState<string | undefined>(() => (url ? getSessionPoster(url) : undefined));
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (thumbnail || !url || !capture) return;
    const cached = getSessionPoster(url);
    if (cached) { setPoster(cached); return; }
    let alive = true;
    ensureSessionPoster(url).then(p => { if (alive && p) setPoster(p); });
    return () => { alive = false; };
  }, [url, thumbnail, capture]);

  const still = thumbnail || poster;

  if (still) return <img src={still} alt="" className={className} />;

  // The pending state is a background ON the video element, not an overlay, so
  // this component stays a single node and never depends on the parent being
  // positioned — it drops into all ~12 call sites unchanged.
  return (
    <video
      // `#t=0.1` asks for a real frame rather than an empty first paint.
      src={url ? `${url}#t=0.1` : undefined}
      muted
      playsInline
      preload="metadata"
      className={`${className} ${painted ? '' : 'bg-neutral-200 animate-pulse'}`}
      onLoadedData={() => setPainted(true)}
    />
  );
};
