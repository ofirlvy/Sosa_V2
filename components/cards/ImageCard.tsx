
import React, { useEffect, useRef, useState } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, ImageCardContent } from '../../types';
import { Loader2, AlertCircle, Play } from 'lucide-react';

interface ImageCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

// Inline video player: shows a poster frame with a Play overlay; clicking plays
// IN PLACE (no modal/popup) with native controls. Becomes `no-drag` once playing
// so interacting with the scrubber doesn't move the card.
const InlineVideo: React.FC<{ url: string; poster?: string; onError: () => void; onMeta?: (w: number, h: number) => void }> = ({ url, poster, onError, onMeta }) => {
  const ref = useRef<HTMLVideoElement>(null);
  // Tied to REAL playback: while playing → native controls + no-drag; while paused
  // or idle → the card is draggable again and the Play button reappears.
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    ref.current?.play(); // onPlay flips isPlaying → controls + no-drag
  };

  return (
    <div className={`w-full h-full relative ${isPlaying ? 'no-drag' : ''}`}>
      <video
        ref={ref}
        // Stable src — never swapped — so Play streams progressively (range requests)
        // instead of a full reload. `#t=0.1` shows a real first frame as the poster.
        src={`${url}#t=0.1`}
        poster={poster}
        preload="metadata"
        playsInline
        controls={isPlaying}
        // When not actively playing the video is click-through so the CARD is
        // draggable (press falls through to BaseCard); only the Play button captures.
        className={`w-full h-full object-cover rounded-xl bg-black/[0.03] select-none ${isPlaying ? '' : 'pointer-events-none'}`}
        onError={onError}
        onLoadedMetadata={(e) => onMeta?.(e.currentTarget.videoWidth || 400, e.currentTarget.videoHeight || 300)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => { setIsPlaying(false); setBuffering(false); }}
        onEnded={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
      />
      {!isPlaying && (
        // Small CENTERED button (not inset-0) so the rest of the frame stays draggable.
        <button
          onClick={start}
          className="no-drag absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center shadow-lg backdrop-blur-sm opacity-80 group-hover:opacity-100 transition-opacity"
          aria-label="Play video"
        >
          <Play size={26} className="ml-0.5" />
        </button>
      )}
      {isPlaying && buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={28} className="animate-spin text-white drop-shadow" />
        </div>
      )}
    </div>
  );
};

export const ImageCard: React.FC<ImageCardProps> = (props) => {
  const { card, onUpdateContent, onResize } = props;
  const content = card.content as ImageCardContent;
  const [error, setError] = useState(false);
  const isVideo = content.mediaType === 'video' || !!content.mimeType?.startsWith('video');

  // Clear any stale error whenever the source changes (e.g. blob preview →
  // Storage URL swap) so a transient failure never sticks as "Failed to load".
  useEffect(() => { setError(false); }, [content.url]);

  // Auto-size from the ACTUAL rendered element's first load (no separate decode,
  // no blob revoke race). The blob preview is already on screen instantly.
  const handleMediaLoad = (nW: number, nH: number) => {
    setError(false);
    if (!nW || !nH) return;
    if (content.loading) {
      const MAX_DIM = content.maxFitDim || 800;
      let width = nW, height = nH;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = width / height;
        if (width > height) { width = MAX_DIM; height = MAX_DIM / ratio; }
        else { height = MAX_DIM; width = MAX_DIM * ratio; }
      }
      onResize(card.id, { width, height });
      onUpdateContent(card.id, { ...content, loading: false, naturalWidth: nW, naturalHeight: nH });
    } else if (!content.naturalWidth || !content.naturalHeight) {
      // Persisted card missing dims → record them (feeds the aspect-snap below).
      onUpdateContent(card.id, { ...content, naturalWidth: nW, naturalHeight: nH });
    }
  };

  // Root fix for a loose bounding box: keep the card box at the media's aspect
  // ratio so object-cover fills it exactly (no canvas showing inside the frame).
  // Corrects already-loaded / persisted cards whose box drifted from the media.
  useEffect(() => {
    if (content.loading) return;
    const nW = content.naturalWidth, nH = content.naturalHeight;
    if (!nW || !nH) return;
    const target = Math.round(card.width * (nH / nW));
    if (Math.abs(target - card.height) > 1) onResize(card.id, { width: card.width, height: target });
  }, [content.loading, content.naturalWidth, content.naturalHeight, card.width, card.height]);

  return (
    <BaseCard
        {...props}
        variant="minimal"
        fixedHeight // definite height = card.height so the media fills the box exactly
        lockAspectRatio={true} // Enforce aspect ratio resizing
    >
      {/* Neutral backdrop so decoding never flashes the canvas through the box. */}
      <div className="w-full h-full relative group bg-gray-50 rounded-xl overflow-hidden">
        {content.uploadPending && !content.url ? (
           // The upload never finished (tab closed mid-upload). Say so explicitly
           // instead of rendering a permanently blank/black player.
           <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 rounded-xl border border-amber-200 text-amber-700 p-4 text-center">
               <AlertCircle size={22} className="mb-2" />
               <span className="text-[11px] font-bold">Upload didn’t finish</span>
               <span className="text-[10px] mt-0.5 opacity-80">Drop the {isVideo ? 'video' : 'image'} here again</span>
           </div>
        ) : error ? (
           <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 rounded-xl border border-red-100 text-red-400 p-4 text-center">
               <AlertCircle size={24} className="mb-2" />
               <span className="text-[11px] font-bold">Failed to load {isVideo ? 'video' : 'image'}</span>
           </div>
        ) : isVideo ? (
           // Media renders immediately from the instant blob preview.
           <InlineVideo url={content.url} poster={content.thumbnail} onError={() => setError(true)} onMeta={handleMediaLoad} />
        ) : (
           <img
             src={content.url}
             alt={content.alt || "Paste"}
             className="w-full h-full object-cover pointer-events-none select-none rounded-xl"
             draggable={false}
             onLoad={(e) => handleMediaLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
             onError={() => setError(true)}
           />
        )}
        {content.uploading && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/55 text-white text-[10px] font-semibold backdrop-blur-sm pointer-events-none">
            <Loader2 size={11} className="animate-spin" /> Uploading…
          </div>
        )}
      </div>
    </BaseCard>
  );
};
