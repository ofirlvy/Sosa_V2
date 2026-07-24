import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MockupVideoProps {
  src?: string;
  poster?: string;
  /** How the video fills its container. Mockups default to 'contain' (never crop). */
  fit?: 'contain' | 'cover';
  /** Reports the media's natural aspect ratio (w/h) once metadata loads. */
  onAspect?: (ratio: number) => void;
  className?: string;
  /** Force muted autoplay (grids/previews). Modals default to sound ON. */
  startMuted?: boolean;
}

/**
 * Shared Instagram-2026-style video player used across every social mockup
 * (Post / Reels / Story / TikTok) so the controls are pixel-identical everywhere:
 *  - autoplay looping, WITH SOUND by default (you opened it to watch it)
 *  - bottom-right mute/unmute pill (Volume2 / VolumeX)
 *  - tap-to-play/pause with a fading center glyph
 * Images are NOT rendered here — each surface keeps its own <img>.
 */
export const MockupVideo: React.FC<MockupVideoProps> = ({
  src,
  poster,
  fit = 'contain',
  onAspect,
  className = '',
  startMuted = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // ALWAYS start muted: muted autoplay is the only kind browsers never block, so
  // the video is guaranteed to actually play. Sound (the default) is turned on a
  // moment later, once it's rolling — see the effect. This is what makes playback
  // reliable: the old code tried UNMUTED first and gave up permanently if either
  // attempt was interrupted (a re-render / slide switch during the ~2s these
  // trailing-moov files take to buffer) — leaving a frozen poster and no video.
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  // The user's intent for sound; separate from the transient `muted` state so a
  // manual mute isn't undone by the auto-unmute.
  const wantSoundRef = useRef(!startMuted);
  wantSoundRef.current = !startMuted;

  // Self-healing playback: keep trying to play whenever the element becomes ready,
  // and NEVER permanently give up. Once it's actually playing, upgrade to sound.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    v.muted = true;
    setMuted(true);

    const tryPlay = () => { if (!cancelled) v.play().catch(() => { /* not ready yet; a ready-event will retry */ }); };

    // Any of these fire as data arrives on a slow, trailing-moov file — retry then.
    const onReady = () => { if (!cancelled && v.paused) tryPlay(); };
    const onPlaying = () => {
      if (cancelled) return;
      setPlaying(true);
      // Turn sound on now that playback is established. Unmuting a PLAYING element
      // needs no user activation, so this doesn't risk pausing it — but if some
      // strict browser still balks, revert to muted (audible-less, but playing).
      if (wantSoundRef.current && v.muted) {
        v.muted = false;
        setMuted(false);
        window.setTimeout(() => {
          if (cancelled) return;
          if (v.paused) { v.muted = true; setMuted(true); tryPlay(); }
        }, 60);
      }
    };
    const onPause = () => { if (!cancelled) setPlaying(false); };
    // A real load error (rare for these H.264 files) — try one clean reload.
    let reloaded = false;
    const onError = () => {
      if (cancelled || reloaded) return;
      reloaded = true;
      try { v.load(); tryPlay(); } catch { /* give the poster the last word */ }
    };

    v.addEventListener('loadeddata', onReady);
    v.addEventListener('canplay', onReady);
    v.addEventListener('canplaythrough', onReady);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    tryPlay(); // kick it off immediately (no-op if data isn't ready; ready-events retry)

    return () => {
      cancelled = true;
      v.removeEventListener('loadeddata', onReady);
      v.removeEventListener('canplay', onReady);
      v.removeEventListener('canplaythrough', onReady);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, [src]);
  // Center glyph that fades out after each play/pause toggle (IG behavior).
  const [glyph, setGlyph] = useState<'play' | 'pause' | null>(null);
  const glyphTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (glyphTimer.current) window.clearTimeout(glyphTimer.current);
    };
  }, []);

  const flashGlyph = (kind: 'play' | 'pause') => {
    setGlyph(kind);
    if (glyphTimer.current) window.clearTimeout(glyphTimer.current);
    glyphTimer.current = window.setTimeout(() => setGlyph(null), 500);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
      flashGlyph('play');
    } else {
      v.pause();
      setPlaying(false);
      flashGlyph('pause');
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    // A manual mute choice sticks — don't let the auto-unmute (on the next
    // `playing` event, e.g. after a tap-pause-tap-play) override it.
    wantSoundRef.current = !next;
    v.muted = next;
    setMuted(next);
    // Unmuting a tab-autoplayed video should also ensure it's actually playing.
    if (!next && v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    }
  };

  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div
      className={`absolute inset-0 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={`absolute inset-0 w-full h-full ${fitClass}`}
        autoPlay
        // Start muted so the browser's OWN autoplay (before our effect runs) is
        // never policy-blocked; the effect keeps it in sync and upgrades to sound
        // once playing. Reliable playback first, sound-on a beat later.
        muted={muted}
        loop
        playsInline
        // 'auto', not 'metadata': these files carry their moov atom at the end,
        // so 'metadata' would never fetch far enough to paint anything.
        preload="auto"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (onAspect && v.videoWidth && v.videoHeight) {
            onAspect(v.videoWidth / v.videoHeight);
          }
        }}
      />

      {/* Center play/pause glyph — fades out after each toggle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white transition-opacity duration-500 ${
            glyph ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {glyph === 'pause'
            ? <Pause size={30} className="fill-white" />
            : <Play size={30} className="fill-white translate-x-0.5" />}
        </div>
      </div>

      {/* Mute / unmute pill — bottom-right, identical on every surface */}
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-20"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
};
