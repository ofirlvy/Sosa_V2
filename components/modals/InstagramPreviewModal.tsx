
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CardData, PostCardContent, MediaItem } from '../../types';
import {
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
  ChevronLeft, ChevronRight, Smile, X
} from 'lucide-react';
import { MockupVideo } from '../media/MockupVideo';
import { sanitizeUsername } from '../../services/mockupProfile';
import { usePoster } from '../media/posterFor';
import { useAssetRatio } from '../media/useAssetRatio';

interface InstagramPreviewModalProps {
  post: CardData;
  onClose: () => void;
  brandName?: string; // Display name (fallback source for the handle)
  username?: string;  // Resolved handle (see services/mockupProfile)
  avatarUrl?: string; // Real brand avatar
}

/**
 * One video slide. Its poster is resolved through `usePoster`, so a still frame
 * appears immediately instead of a gray box while the clip downloads.
 * `onMeasured` is only passed for asset[0] — the slide that sizes the frame.
 */
const SlideVideo: React.FC<{ asset: MediaItem; onMeasured?: (ratio: number) => void }> = ({ asset, onMeasured }) => {
  const poster = usePoster(asset);
  return (
    <MockupVideo
      src={asset.url}
      poster={poster}
      fit="cover"
      onAspect={onMeasured}
      className="bg-gray-100"
    />
  );
};

export const InstagramPreviewModal: React.FC<InstagramPreviewModalProps> = ({
  post,
  onClose,
  brandName = "Orbit Brand",
  username: usernameProp,
  avatarUrl,
}) => {
  const content = post.content as PostCardContent;
  const assets = (content.finalAssets && content.finalAssets.length > 0) 
    ? content.finalAssets 
    : (content.references && content.references.length > 0) 
      ? content.references 
      : [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Frame height follows the FIRST asset's natural ratio (w/h) — no letterbox.
  // Resolved from the cheapest source available (session cache → poster image →
  // video metadata) so the frame is right on the FIRST paint. Reading it from the
  // <video> alone took 1-2.4s, during which the media showed cropped to 4:5.
  const { ratio: mediaRatio, report: reportSize, reportRatio } = useAssetRatio(assets[0]);

  // Safely clamp active slide index if item count dynamically changes
  useEffect(() => {
    if (currentSlide >= assets.length) {
      setCurrentSlide(Math.max(0, assets.length - 1));
    }
  }, [assets.length, currentSlide]);

  // Username logic: Use explicit author if available, otherwise post title or brand name
  // Removing spaces for a more "handle-like" look
  const username = usernameProp || sanitizeUsername(brandName || "brand_account");

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, assets.length]);

  const navigate = (dir: number) => {
    if (assets.length <= 1) return;
    const newIndex = currentSlide + dir;
    if (newIndex >= 0 && newIndex < assets.length) {
      setCurrentSlide(newIndex);
    }
  };

  const hasMultiple = assets.length > 1;

  // Caption Logic - Use exact text from card
  const caption = content.caption || "";
  const shouldTruncate = caption.length > 120 && !isExpanded;
  const displayCaption = shouldTruncate ? caption.slice(0, 120) + "..." : caption;

  // Comments Logic
  const commentCount = content.comments?.length || 0;

  if (!post) return null;

  // The frame's height is driven by the first asset's natural ratio (mediaRatio),
  // so the media fills it exactly with no gray letterbox. `reportsAspect` = this is
  // asset[0], so report its natural ratio back up to size the frame.
  // Instagram model: the frame's ratio = asset[0]'s ratio; every slide is rendered
  // object-cover (fill). Single item → frame matches it → no crop, no gray bars.
  // Carousel → item 0 exact, the rest cropped to the shared frame, exactly like IG.
  const renderMedia = (asset: MediaItem, reportsAspect: boolean) => {
      if (asset.type === 'video') {
          return <SlideVideo asset={asset} onMeasured={reportsAspect ? reportRatio : undefined} />;
      }
      return (
          <img
              src={asset.url}
              className="absolute inset-0 w-full h-full object-cover block bg-gray-100"
              alt="Post content"
              onLoad={reportsAspect ? (e) => {
                  const img = e.currentTarget;
                  reportSize(img.naturalWidth, img.naturalHeight);
              } : undefined}
          />
      );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      
      {/* Close Button (Fixed Top Right) */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>

      {/* Mobile-Style Card Container */}
      <div 
        className="w-[400px] max-h-[95vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 shrink-0 bg-white z-10">
           <div className="flex items-center gap-3">
              {/* Avatar Placeholder */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
                 <div className="w-full h-full rounded-full bg-white border-2 border-white overflow-hidden">
                    <img
                        src={avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random`}
                        alt="avatar"
                        className="w-full h-full object-cover"
                    />
                 </div>
              </div>
              <span className="text-[14px] font-semibold text-[#262626]">{username}</span>
           </div>
           <MoreHorizontal size={20} className="text-[#262626]" />
        </div>

        {/* 2. Media Area — the frame's aspect ratio follows asset[0]'s natural ratio,
             so the media fills it exactly (no gray letterbox). useAssetRatio resolves
             that ratio without rendering anything, so viewing a later carousel slide
             keeps the frame correct with no hidden element. */}
        <div className="group relative w-full bg-gray-100 shrink-0 overflow-hidden" style={{ aspectRatio: mediaRatio }}>
            {assets.length > 0 ? (
                <>
                    {/* VISIBLE ELEMENT (Current Slide) */}
                    <div className="absolute inset-0">
                        {renderMedia(assets[currentSlide], currentSlide === 0)}
                    </div>

                    {/* Carousel counter pill (IG 2026) — top-right of the media */}
                    {hasMultiple && (
                        <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-black/60 text-white text-[12px] font-semibold pointer-events-none">
                            {currentSlide + 1}/{assets.length}
                        </div>
                    )}

                    {/* Navigation Arrows — appear on hover, circular like IG on web */}
                    {hasMultiple && currentSlide > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-md text-gray-800 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                            <ChevronLeft size={16} strokeWidth={3} />
                        </button>
                    )}
                    {hasMultiple && currentSlide < assets.length - 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-md text-gray-800 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                            <ChevronRight size={16} strokeWidth={3} />
                        </button>
                    )}
                </>
            ) : (
                // Empty State Fallback
                <div className="w-full aspect-square flex flex-col items-center justify-center text-gray-400">
                    <span className="text-[12px] font-medium">No Assets Uploaded</span>
                </div>
            )}
        </div>

        {/* Carousel Dots — their own centered row above the icons, exactly like IG */}
        {hasMultiple && (
            <div className="flex justify-center items-center gap-1.5 pt-2.5 pb-0.5 shrink-0 bg-white">
                {assets.map((_, idx) => (
                    <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentSlide ? 'bg-[#0095F6]' : 'bg-gray-300'}`}
                    />
                ))}
            </div>
        )}

        {/* 3. Action Bar */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsLiked(!isLiked)} className="hover:opacity-60 transition-opacity">
                    <Heart size={24} className={isLiked ? "fill-red-500 text-red-500" : "text-[#262626]"} strokeWidth={isLiked ? 0 : 2} />
                </button>
                <button className="hover:opacity-60 transition-opacity">
                    <MessageCircle size={24} className="text-[#262626] -rotate-90" />
                </button>
                <button className="hover:opacity-60 transition-opacity">
                    <Send size={24} className="text-[#262626] rotate-12 mb-1" />
                </button>
            </div>

            <button onClick={() => setIsSaved(!isSaved)} className="hover:opacity-60 transition-opacity">
                <Bookmark size={24} className={isSaved ? "fill-black text-black" : "text-[#262626]"} />
            </button>
        </div>

        {/* 4. Details Scroll Area (Flex grow to fill remaining space) */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white flex flex-col">
            <div className="px-4 pb-2 text-[14px] text-[#262626]">
                {/* Likes */}
                <div className="font-semibold mb-2 text-[13px]">
                   {isLiked ? '1 like' : 'Be the first to like this'}
                </div>

                {/* Caption */}
                {caption && (
                    <div className="mb-2 leading-tight">
                        <span className="font-semibold mr-1.5">{username}</span>
                        <span className="text-[#262626] whitespace-pre-wrap">{displayCaption}</span>
                        {shouldTruncate && (
                            <button onClick={() => setIsExpanded(true)} className="text-gray-500 text-[13px] ml-1 hover:text-gray-900">
                                more
                            </button>
                        )}
                    </div>
                )}

                {/* View Comments Link */}
                {commentCount > 0 && (
                    <div className="text-gray-500 text-[13px] mb-2 cursor-pointer hover:text-gray-900">
                        View all {commentCount} comments
                    </div>
                )}

                {/* Internal Comments Preview */}
                {content.comments?.map(comment => (
                    <div key={comment.id} className="flex gap-2 mb-1 text-[13px]">
                        <span className="font-semibold">{comment.user === 'You' ? 'me' : comment.user.toLowerCase().replace(' ', '_')}</span>
                        <span>{comment.text}</span>
                    </div>
                ))}

                {/* Date */}
                {content.date && (
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 mb-3 font-medium">
                        {new Date(content.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </div>
                )}
            </div>

            {/* 5. Footer: Comment Input */}
            <div className="h-12 border-t border-gray-100 flex items-center px-4 gap-3 shrink-0 mt-auto bg-white">
                <Smile size={20} className="text-[#262626]" />
                <input 
                    className="flex-1 text-[13px] outline-none border-none placeholder-gray-400 bg-transparent"
                    placeholder="Add a comment..."
                />
                <button className="text-[13px] font-semibold text-[#0095F6] disabled:opacity-50 hover:text-[#00376b]">
                    Post
                </button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
