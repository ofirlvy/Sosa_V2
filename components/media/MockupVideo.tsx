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
  const [muted, setMuted] = useState(startMuted);
  const [playing, setPlaying] = useState(true);

  // Browsers only allow UNMUTED autoplay when the page has user activation.
  // Opening this modal is a click, so it normally succeeds — but if the browser
  // still refuses, fall back to muted playback rather than showing a dead frame.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || startMuted) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setPlaying(false));
    });
  }, [src, startMuted]);
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
        // `muted` is driven imperatively (see the effect above) so the sound-on
        // default can fall back to muted when the browser blocks autoplay.
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
