import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CardData, ReelsCardContent, MediaItem } from '../../types';
import { X, Heart, MessageCircle, Send, Bookmark, Music2, MoreHorizontal } from 'lucide-react';
import { MockupVideo } from '../media/MockupVideo';
import { sanitizeUsername } from '../../services/mockupProfile';
import { usePoster } from '../media/posterFor';

interface ReelsPreviewModalProps {
  reel: CardData;
  onClose: () => void;
  brandName?: string;
  username?: string; // Resolved handle (see services/mockupProfile)
  avatarUrl?: string;
}

// Vertical 9:16 short-form player (Instagram Reels / TikTok). One clean player; branding follows `platform`.
/** The reel's video; its poster resolves reactively (see media/posterFor). */
const CoverVideo: React.FC<{ asset: MediaItem }> = ({ asset }) => (
  <MockupVideo src={asset.url} poster={usePoster(asset)} fit="contain" className="bg-black" />
);

export const ReelsPreviewModal: React.FC<ReelsPreviewModalProps> = ({ reel, onClose, brandName = 'Orbit Brand', username: usernameProp, avatarUrl }) => {
  const content = reel.content as ReelsCardContent;
  const cover = content.cover;
  const username = usernameProp || sanitizeUsername(brandName || 'brand_account');
  const isTikTok = content.platform === 'tiktok';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
        <X size={24} />
      </button>

      <div className="relative w-[330px] aspect-[9/16] max-h-[92vh] bg-black rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        {/* Media */}
        {cover ? (
          cover.type === 'video'
            ? <CoverVideo asset={cover} />
            : <img src={cover.url} className="absolute inset-0 w-full h-full object-contain" alt="reel cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-[13px]">Add a cover / video</div>
        )}

        {/* gradients */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* top label */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between text-white">
          <span className="text-[14px] font-bold drop-shadow">{isTikTok ? 'For You' : 'Reels'}</span>
          <MoreHorizontal size={20} />
        </div>

        {/* right action rail */}
        <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-4 text-white">
          {[{ I: Heart, n: '12.4k' }, { I: MessageCircle, n: '208' }, { I: Send, n: '96' }, { I: Bookmark, n: '' }].map(({ I, n }, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center"><I size={22} className="drop-shadow" /></div>
              {n && <span className="text-[11px] font-semibold drop-shadow">{n}</span>}
            </div>
          ))}
        </div>

        {/* bottom meta */}
        <div className="absolute bottom-3 left-3 right-16 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random`} className="w-7 h-7 rounded-full border border-white object-cover" alt="avatar" />
            <span className="text-[13px] font-semibold drop-shadow">{username}</span>
          </div>
          {content.caption && <p className="text-[13px] leading-snug drop-shadow line-clamp-3 mb-1.5" dir="auto">{content.caption}</p>}
          <div className="flex items-center gap-1.5 text-[12px] drop-shadow">
            <Music2 size={13} />
            <span className="truncate">{content.soundName || 'Original audio'}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
