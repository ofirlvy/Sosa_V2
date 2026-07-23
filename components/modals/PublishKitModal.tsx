import React, { useState } from 'react';
import { CardData, CardType, PostCardContent, ReelsCardContent, MediaItem } from '../../types';
import { QueueItem, PLATFORM_META } from '../../services/publishReminders';
import { X, Copy, Check, ExternalLink, Download, Send } from 'lucide-react';
import { VideoThumb } from '../media/VideoThumb';

// The Phase-B "publish kit": when a scheduled target comes due, this hands the
// user everything needed to post in ~20 seconds — the media, the caption
// (one-tap copy), and a deep link to the platform's composer — then marks the
// target published. Phase C replaces this with true auto-publish for connected
// platforms; the kit stays as the fallback for unconnected ones.

interface PublishKitModalProps {
  item: QueueItem;
  onMarkPublished: () => void;
  onDismiss: () => void; // keep as needs_action (publish later)
}

const kitMedia = (card: CardData): MediaItem[] => {
  if (card.type === CardType.REELS) {
    const cover = (card.content as ReelsCardContent).cover;
    return cover ? [cover] : [];
  }
  const pc = card.content as PostCardContent;
  return (pc.finalAssets?.length ? pc.finalAssets : pc.references) || [];
};

export const PublishKitModal: React.FC<PublishKitModalProps> = ({ item, onMarkPublished, onDismiss }) => {
  const content = item.card.content as PostCardContent | ReelsCardContent;
  const meta = PLATFORM_META[item.target.platform];
  const caption = item.target.caption ?? content.caption ?? '';
  const media = kitMedia(item.card);
  const [copied, setCopied] = useState(false);

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/25 backdrop-blur-sm p-8" onClick={onDismiss}>
      <div className="relative w-full max-w-[440px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFD753]/40 text-[#5F2427] flex items-center justify-center shrink-0">
              <Send size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#3A5C34]">Time to publish</div>
              <div className="text-[15px] font-bold text-gray-900 truncate" dir="auto">{(content as any).title || 'Untitled'} → {meta.label}</div>
            </div>
          </div>
          <button onClick={onDismiss} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* 1. Media */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">1 · Save the media</div>
            {media.length === 0 ? (
              <p className="text-[12px] text-gray-400">No media on this card — add it before posting.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {media.slice(0, 6).map((m, i) => (
                  <a
                    key={m.id || i}
                    href={m.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100"
                    title="Download"
                  >
                    {m.type === 'video'
                      ? <VideoThumb url={m.url} thumbnail={m.thumbnail} />
                      : <img src={m.url} className="w-full h-full object-cover" />}
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all">
                      <Download size={18} />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 2. Caption */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">2 · Copy the caption</div>
            <div className="relative rounded-xl border border-gray-200 bg-[#F9F8F6] p-3">
              <p dir="auto" className="text-[13px] text-gray-700 leading-snug whitespace-pre-wrap break-words max-h-32 overflow-y-auto no-scrollbar pr-8">
                {caption || <span className="text-gray-400 italic">No caption</span>}
              </p>
              {caption && (
                <button
                  onClick={copyCaption}
                  className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${copied ? 'bg-[#3A5C34] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-800'}`}
                  title="Copy caption"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          {/* 3. Open composer */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">3 · Post it</div>
            <a
              href={meta.composerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl bg-[#5F2427] text-[#FCCAE2] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#4a1c1f] transition-colors"
            >
              Open {meta.label} <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={onDismiss} className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-200 transition-colors">Later</button>
          <button onClick={onMarkPublished} className="flex-1 h-10 rounded-xl bg-[#3A5C34] text-white text-[13px] font-bold hover:bg-[#2d4a29] transition-colors flex items-center justify-center gap-1.5">
            <Check size={15} /> Mark as published
          </button>
        </div>
      </div>
    </div>
  );
};
