import React, { useEffect, useState } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, LinkCardContent } from '../../types';
import { ExternalLink, Play, Loader2, Link as LinkIcon, X } from 'lucide-react';
import { fetchLinkMetadata, youTubeVideoId } from '../../services/linkService';

const HEADER_H = 40; // header strip height (h-10) — excluded from the media aspect

interface LinkCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  isExpanded?: boolean;
  isFullscreen?: boolean;
}

// --- Platform Logos (Official Colors) ---
const YouTubeLogo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-[#FF0000]">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const InstagramLogo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-[#E4405F]">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.44 1.44 0 1 1 2.88 0 1.44 1.44 0 0 1-2.88 0z"/>
  </svg>
);

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-black">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const PinterestLogo = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-[#E60023]">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.399.165-1.487-.695-2.419-2.875-2.419-4.629 0-3.773 2.749-7.253 7.951-7.253 4.173 0 7.41 2.967 7.41 6.923 0 4.133-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
    </svg>
);

export const LinkCard: React.FC<LinkCardProps> = (props) => {
  const { card, onUpdateContent, onResize } = props;
  const content = card.content as LinkCardContent;
  const [hasError, setHasError] = useState(false);
  // YouTube still plays inline via its iframe (2-state). IG/TikTok/Pinterest are
  // single-state "media" cards: cover at native aspect, click/Play opens on the
  // platform (no live embed → no platform chrome, no 2-stage).
  const [playing, setPlaying] = useState(false);
  const ytId = content.platform === 'youtube' ? youTubeVideoId(content.url) : null;
  const isPinterest = content.platform === 'pinterest';
  const isSocialMedia = content.platform === 'instagram' || content.platform === 'tiktok' || isPinterest;
  const isPlaying = playing && !!ytId;

  const openExternal = () => window.open(content.url, '_blank', 'noopener,noreferrer');

  // Fit the card to the cover's native aspect ratio (header + media aspect), so
  // social posts show at their real proportions (not a fixed square). Runs once
  // per loaded image; idempotent guard avoids a resize loop.
  const fitToCover = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const target = HEADER_H + Math.round(card.width * img.naturalHeight / img.naturalWidth);
    if (Math.abs(target - card.height) > 1) onResize(card.id, { width: card.width, height: target });
  };

  // Initial Fetch Effect
  useEffect(() => {
    if (content.loading) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const loadMetadata = async () => {
        try {
          const meta = await fetchLinkMetadata(content.url);
          if (!controller.signal.aborted) {
            onUpdateContent(card.id, { ...content, ...meta, loading: false });
          }
        } catch (e) {
          if (!controller.signal.aborted) {
            setHasError(true);
            onUpdateContent(card.id, { ...content, loading: false, title: content.url });
          }
        }
      };
      loadMetadata();
      return () => { clearTimeout(timeout); controller.abort(); };
    }
  }, [content.url, content.loading]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(content.url, '_blank', 'noopener,noreferrer');
  };

  const getPlatformIcon = () => {
    switch(content.platform) {
      case 'youtube': return <YouTubeLogo />;
      case 'instagram': return <InstagramLogo />;
      case 'pinterest': return <PinterestLogo />;
      case 'tiktok': return <TikTokLogo />;
      default: return content.favicon ? <img src={content.favicon} className="w-4 h-4 rounded-sm" /> : <LinkIcon size={14} className="text-gray-400" />;
    }
  };

  const getDomainFromUrl = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace('www.', '');
    } catch {
      return urlStr;
    }
  };


  // --- RENDERING STRATEGIES ---

  const renderPinterestCollage = () => {
    const images = content.images || [];
    if (images.length === 0) return null;

    if (images.length < 3) {
        // Single Hero or Double Split
        return (
            <div className="w-full h-full bg-gray-100 flex overflow-hidden">
                {images.map((img, i) => (
                    <img key={i} src={img} className="h-full object-cover flex-1 min-w-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                ))}
            </div>
        );
    }
    
    // Bento Grid (1 Large, 2 Small)
    return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 bg-white">
            <div className="row-span-2 relative bg-gray-100">
                <img src={images[0]} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
            </div>
            <div className="relative bg-gray-100">
                <img src={images[1]} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
            </div>
            <div className="relative bg-gray-100">
                <img src={images[2]} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                {images.length > 3 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xs">
                        +{images.length - 3}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderContent = () => {
    // 1. Pinterest Collage
    if (content.platform === 'pinterest' && content.images && content.images.length > 0) {
        return renderPinterestCollage();
    }

    // 2. Standard Image (YouTube, Instagram, Generic)
    if (content.imageUrl && !hasError) {
        return (
            <>
                <img
                    src={content.imageUrl}
                    alt="Preview"
                    className={`w-full h-full object-cover ${content.platform === 'youtube' ? 'transition-transform duration-700 group-hover:scale-105' : ''}`}
                    onLoad={isSocialMedia ? (e) => fitToCover(e.currentTarget) : undefined}
                    onError={() => setHasError(true)}
                />
                {content.platform === 'youtube' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); if (ytId) setPlaying(true); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="no-drag absolute inset-0 flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
                        title="Play video"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#FF0000] text-white flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                            <Play fill="currentColor" size={16} className="ml-0.5" />
                        </div>
                    </button>
                )}
            </>
        );
    }

    // 3. Fallback — a CLEAN neutral cover when no image could be fetched keyless
    // (no loud gradient). Still click-to-open. Soft pulse hints "enriching".
    const label = content.siteName || getDomainFromUrl(content.url);
    return (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center bg-gray-50 ${content.loading ? 'animate-pulse' : ''}`}>
            <span className="opacity-70">{getPlatformIcon()}</span>
            <p className="text-[11px] font-medium text-gray-400">
              {content.isVideo ? `Watch on ${label}` : `Open on ${label}`}
            </p>
        </div>
    );
  };

  const getPreviewHeightClass = () => {
     if (content.platform === 'youtube') return 'aspect-video';
     if (content.platform === 'instagram') return 'aspect-square';
     if (content.platform === 'pinterest') return 'aspect-square';
     if (content.platform === 'tiktok') return 'aspect-[9/14]'; // tall vertical video
     return content.imageUrl ? 'aspect-video' : 'h-32';
  };

  return (
    <BaseCard {...props} variant="minimal" fixedHeight>
      {/* Chromeless link card: the media IS the card (rounded, flush — no white
          bounding box). While a YouTube video plays, a full-bleed player overlay
          fills the whole card (so it always matches the bounding box). */}
      <div
        className="relative w-full h-full bg-white rounded-[20px] overflow-hidden flex flex-col group transition-shadow"
        onDoubleClick={handleDoubleClick}
      >
        {/* --- INLINE YOUTUBE PLAYER (fills the entire card) --- */}
        {isPlaying && ytId && (
          <div className="absolute inset-0 z-30 animate-in fade-in duration-300 bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
              title={content.title || 'YouTube video'}
              className="w-full h-full no-drag border-0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={(e) => { e.stopPropagation(); setPlaying(false); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag absolute top-2 right-2 z-40 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* --- HEADER STRIP --- */}
        <div className="px-4 h-10 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10 shrink-0 border-b border-gray-100">
           <div className="flex items-center gap-2 max-w-[85%]">
             <div className="shrink-0 flex items-center justify-center">
               {getPlatformIcon()}
             </div>
             <span className="text-[12px] font-semibold text-gray-700 truncate">
               {content.siteName || getDomainFromUrl(content.url)}
             </span>
           </div>
           <div className="text-gray-400 group-hover:text-[#3A5C34] transition-colors flex items-center gap-1.5">
              {content.loading && <Loader2 size={12} className="animate-spin text-gray-300" />}
              <ExternalLink size={14} />
           </div>
        </div>

        {/* --- PREVIEW AREA --- */}
        {/* Always render immediately (branded placeholder or thumbnail); the real
            image swaps in when the background fetch resolves — no blocking spinner. */}
        <div className={`relative w-full bg-gray-50 flex items-center justify-center overflow-hidden ${isSocialMedia ? 'flex-1' : `shrink-0 ${getPreviewHeightClass()}`}`}>
          {renderContent()}
          {/* Single-state social card: the whole media opens the post/reel/pin on
              the platform. A Play badge marks reels/videos. No live embed. */}
          {isSocialMedia && !content.loading && (
            <button
              onClick={(e) => { e.stopPropagation(); openExternal(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag absolute inset-0 flex items-center justify-center cursor-pointer bg-black/0 hover:bg-black/10 transition-colors"
              title={content.isVideo ? 'Play on the platform' : 'Open link'}
            >
              {content.isVideo && (
                <span className="w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <Play fill="currentColor" size={24} className="ml-0.5" />
                </span>
              )}
              <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink size={13} />
              </span>
            </button>
          )}
        </div>

        {/* --- CONTENT FOOTER (YouTube / generic only — social cards are media-only) --- */}
        {!isSocialMedia && (
        <div className="flex-1 p-4 flex flex-col min-h-0 bg-white">
           <h3 className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2 mb-1" title={content.title}>
             {content.title || content.siteName || getDomainFromUrl(content.url)}
           </h3>
           {content.description && (
             <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
                 {content.description}
             </p>
           )}
           {content.platform === 'generic' && !content.loading && (
             <div className="mt-auto pt-2 text-[11px] text-gray-400 font-medium truncate">
                 {getDomainFromUrl(content.url)}
             </div>
           )}
        </div>
        )}
      </div>
    </BaseCard>
  );
};