import React from 'react';
import { CardData, CardType, MediaItem, PostCardContent, ReelsCardContent, StoryCardContent } from '../../types';
import { FeedItem } from '../../services/feedPlanner';
import { VideoThumb } from '../media/VideoThumb';
import { X, CalendarPlus, Video, FileImage, CircleDashed } from 'lucide-react';
import { parseISODate } from '../../services/dateUtils';

// Clicking an EMPTY slot (feed or story) opens this picker to schedule an
// unscheduled item onto that day — a focused popup instead of the drawer. The
// drawer stays reachable from the "Unscheduled" toolbar button.

const media = (card: CardData): MediaItem | undefined => {
  if (card.type === CardType.REELS) return (card.content as ReelsCardContent).cover || undefined;
  if (card.type === CardType.STORY) return (card.content as StoryCardContent).frames?.[0];
  const pc = card.content as PostCardContent;
  return pc.finalAssets?.[0] || pc.references?.[0];
};
const title = (card: CardData): string => (card.content as any)?.title || (card.type === CardType.REELS ? 'Untitled Reel' : card.type === CardType.STORY ? 'Untitled Story' : 'Untitled Post');
const typeLabel = (t: CardType) => t === CardType.REELS ? 'Reel' : t === CardType.STORY ? 'Story' : 'Post';
const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

interface Props {
  dateISO: string;
  kind: 'feed' | 'story';
  items: FeedItem[];
  onPick: (item: FeedItem) => void;
  onClose: () => void;
}

export const SlotPickerModal: React.FC<Props> = ({ dateISO, kind, items, onPick, onClose }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
    <div
      onClick={e => e.stopPropagation()}
      className="bg-[#F9F8F6] rounded-[24px] shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] border border-[#5F2427]/10 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#5F2427]/5 shrink-0 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0"><CalendarPlus size={17} /></div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#5F2427] leading-tight">Schedule {kind === 'story' ? 'a story' : 'a post'}</div>
            <div className="text-[12px] text-[#5F2427]/50 leading-tight">{fmt(dateISO)}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-[#5F2427]/10 text-[#5F2427]/60 hover:bg-[#FCCAE2] hover:text-[#5F2427] transition-all shrink-0"><X size={17} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {items.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-center px-8">
            <CircleDashed size={30} className="mb-3 opacity-20" />
            <p className="text-[13px] font-semibold text-gray-500">Nothing unscheduled</p>
            <p className="text-[12px] mt-1">Create {kind === 'story' ? 'a story' : 'a post'} on a board — it'll show up here to schedule.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {items.map(item => {
              const m = media(item.card);
              return (
                <button
                  key={item.card.id}
                  onClick={() => onPick(item)}
                  className="group text-left rounded-xl border border-[#5F2427]/10 bg-white overflow-hidden hover:border-[#3A5C34]/40 hover:shadow-sm transition-all"
                >
                  <div className="aspect-[4/5] bg-gray-50 flex items-center justify-center text-gray-300 overflow-hidden">
                    {m?.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" />
                      : m?.type === 'video' ? <VideoThumb url={m.url} thumbnail={m.thumbnail} className="w-full h-full object-cover" />
                      : item.card.type === CardType.REELS ? <Video size={22} /> : <FileImage size={22} />}
                  </div>
                  <div className="p-2">
                    <div className="text-[12px] font-semibold text-gray-800 truncate" dir="auto">{title(item.card)}</div>
                    <div className="text-[10px] text-gray-400">{typeLabel(item.card.type)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
);
