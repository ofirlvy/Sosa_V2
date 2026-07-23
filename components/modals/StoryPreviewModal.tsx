import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CardData, StoryCardContent, MediaItem } from '../../types';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MockupVideo } from '../media/MockupVideo';
import { sanitizeUsername } from '../../services/mockupProfile';
import { usePoster } from '../media/posterFor';

interface StoryPreviewModalProps {
  story: CardData;
  onClose: () => void;
  brandName?: string;
  username?: string; // Resolved handle (see services/mockupProfile)
  avatarUrl?: string;
}

// Instagram-Stories-style viewer: 9:16, segmented progress bars, tap to navigate.
/** One story frame's video; its poster resolves reactively (see media/posterFor). */
const FrameVideo: React.FC<{ asset: MediaItem }> = ({ asset }) => (
  <MockupVideo src={asset.url} poster={usePoster(asset)} fit="contain" className="bg-black" />
);

export const StoryPreviewModal: React.FC<StoryPreviewModalProps> = ({ story, onClose, brandName = 'Orbit Brand', username: usernameProp, avatarUrl }) => {
  const content = story.content as StoryCardContent;
  const frames: MediaItem[] = content.frames || [];
  const [index, setIndex] = useState(0);
  const username = usernameProp || sanitizeUsername(brandName || 'brand_account');

  const go = (dir: number) => {
    setIndex(i => {
      const n = i + dir;
      if (n < 0) return 0;
      if (n >= frames.length) return frames.length - 1;
      return n;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length]);

  const current = frames[index];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
        <X size={24} />
      </button>

      <div
        className="relative w-[330px] aspect-[9/16] max-h-[92vh] bg-black rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media */}
        {current ? (
          current.type === 'video'
            ? <FrameVideo key={current.id} asset={current} />
            : <img src={current.url} className="absolute inset-0 w-full h-full object-contain" alt="story frame" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[13px]">No story frames yet</div>
        )}

        {/* Top gradient for legibility */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        {/* Segmented progress bars */}
        <div className="absolute top-2.5 inset-x-2.5 flex gap-1">
          {(frames.length ? frames : [null]).map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: i < index ? '100%' : i === index ? '100%' : '0%' }} />
            </div>
          ))}
        </div>

        {/* User row */}
        <div className="absolute top-6 inset-x-3 flex items-center gap-2.5 pt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random`} alt="avatar" className="w-full h-full rounded-full object-cover border-2 border-black" />
          </div>
          <span className="text-[13px] font-semibold text-white drop-shadow">{username}</span>
          <span className="text-[12px] text-white/70">{index + 1}/{Math.max(frames.length, 1)}</span>
        </div>

        {/* Tap zones */}
        {frames.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="previous" />
            <button onClick={() => go(1)} className="absolute right-0 top-0 bottom-0 w-1/3" aria-label="next" />
            {index > 0 && <ChevronLeft size={20} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />}
            {index < frames.length - 1 && <ChevronRight size={20} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
