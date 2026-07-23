import React, { useRef, useEffect } from 'react';
import { FeedItem } from '../services/feedPlanner';
import { StoryCardContent, MediaItem } from '../types';
import { VideoThumb } from './media/VideoThumb';
import { Plus, Pencil, Flag } from 'lucide-react';

// The story lane: a horizontal strip of one circle PER DAY of the visible month,
// below the (posts+reels) grid. It gently auto-scrolls so you sense all the days
// (pausing exactly where the mouse rests), shows event flags, and supports drag
// (tray→day, and day→day to swap dates). Stories schedule ONLY here, never in the
// grid, and are viewed one day at a time. See memory feed_planner_page.

const firstFrame = (item: FeedItem): MediaItem | undefined =>
  (item.card.content as StoryCardContent).frames?.[0];

interface StoriesLaneProps {
  days: string[];
  groups: { iso: string; items: FeedItem[] }[];
  todayISO: string;
  dragActive: boolean;                 // a story drag is in progress (tray OR lane)
  dropTargetISO: string | null;
  eventDays: Set<string>;              // days that have calendar events
  onHoverDay: (iso: string | null) => void;
  onDropDay: (iso: string) => void;
  onOpenDay: (iso: string) => void;
  onEditDay: (iso: string) => void;
  onDragStartDay: (iso: string) => void; // begin a day→day drag from a filled day
  onDayDragEnd: () => void;               // drag ended (dropped or cancelled)
  onOpenEvents: (iso: string) => void;   // click the event flag
  onPickDay: (iso: string) => void;      // click an empty day → picker popup
}

export const StoriesLane: React.FC<StoriesLaneProps> = ({
  days, groups, todayISO, dragActive, dropTargetISO, eventDays,
  onHoverDay, onDropDay, onOpenDay, onEditDay, onDragStartDay, onDayDragEnd, onOpenEvents, onPickDay,
}) => {
  const byDay = new Map(groups.map(g => [g.iso, g.items]));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const dragRef = useRef(dragActive);
  dragRef.current = dragActive;

  // Gentle ping-pong auto-scroll so the user senses the whole month. Pauses on
  // hover (freezes exactly where the mouse is) and while dragging; honours
  // reduced-motion; no-op when the strip fits without overflow.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let dir = 1;
    const step = () => {
      if (!pausedRef.current && !dragRef.current && el.scrollWidth > el.clientWidth + 4) {
        const max = el.scrollWidth - el.clientWidth;
        let next = el.scrollLeft + dir * 0.35; // ~21px/s — calm
        if (next >= max) { next = max; dir = -1; }
        else if (next <= 0) { next = 0; dir = 1; }
        el.scrollLeft = next;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const EventFlag = ({ iso }: { iso: string }) => eventDays.has(iso) ? (
    <span
      role="button"
      aria-label="Event"
      title="View event"
      onClick={(e) => { e.stopPropagation(); onOpenEvents(iso); }}
      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-md border border-[#5F2427]/10 flex items-center justify-center text-[#FF3B30] hover:scale-110 transition-transform z-20"
    >
      <Flag size={10} className="fill-[#FF3B30]" />
    </span>
  ) : null;

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2 mb-1 px-0.5">
        <span className="text-[12px] font-bold text-gray-500">Stories</span>
        <span className="text-[11px] text-gray-400">drag onto a day · click an empty day to add</span>
      </div>
      <div
        ref={scrollerRef}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; onHoverDay(null); }}
        className="flex gap-2 overflow-x-auto no-scrollbar px-2 py-2"
      >
        {days.map(iso => {
          const items = byDay.get(iso);
          const day = parseInt(iso.slice(8), 10);
          const isToday = iso === todayISO;
          const isDrop = dropTargetISO === iso && dragActive;

          if (items && items.length) {
            const media = firstFrame(items[0]);
            return (
              <div key={iso} className="shrink-0 flex flex-col items-center gap-1 group/story">
                <button
                  draggable
                  onDragStart={() => onDragStartDay(iso)}
                  onClick={() => onOpenDay(iso)}
                  onDragOver={dragActive ? (e) => { e.preventDefault(); onHoverDay(iso); } : undefined}
                  onDragLeave={() => onHoverDay(null)}
                  onDrop={dragActive ? (e) => { e.preventDefault(); onDropDay(iso); } : undefined}
                  title="View this day’s stories · drag to move"
                  className={`relative w-14 h-14 rounded-full p-[2.5px] transition-transform hover:scale-105 cursor-grab active:cursor-grabbing ${isDrop ? 'ring-2 ring-inset ring-[#3A5C34]' : ''}`}
                  style={{ background: 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' }}
                >
                  <span className="block w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
                    <span className="block w-full h-full rounded-full overflow-hidden bg-gray-100">
                      {media?.type === 'image' && <img src={media.url} className="w-full h-full object-cover pointer-events-none" />}
                      {media?.type === 'video' && <VideoThumb url={media.url} thumbnail={media.thumbnail} className="w-full h-full object-cover pointer-events-none" />}
                    </span>
                  </span>
                  {items.length > 1 && (
                    <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#5F2427] text-white text-[9px] font-bold flex items-center justify-center border border-white">{items.length}</span>
                  )}
                  <span
                    role="button"
                    aria-label="Edit"
                    onClick={(e) => { e.stopPropagation(); onEditDay(iso); }}
                    className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/story:opacity-100 transition-opacity z-20"
                  >
                    <Pencil size={10} />
                  </span>
                  <EventFlag iso={iso} />
                </button>
                <span className={`text-[10px] font-semibold ${isToday ? 'text-[#e58bb8]' : 'text-gray-500'}`}>{day}</span>
              </div>
            );
          }

          // Empty day — click to pick an unscheduled story; also a drop target.
          return (
            <div key={iso} className="shrink-0 flex flex-col items-center gap-1 group/story">
              <button
                onClick={() => onPickDay(iso)}
                onDragOver={dragActive ? (e) => { e.preventDefault(); onHoverDay(iso); } : undefined}
                onDragLeave={() => onHoverDay(null)}
                onDrop={dragActive ? (e) => { e.preventDefault(); onDropDay(iso); } : undefined}
                title="Add a story to this day"
                className={`relative w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${
                  isDrop ? 'border-[#3A5C34] bg-[#3A5C34]/5'
                    : isToday ? 'border-[#F0A6C9] bg-[#FCCAE2]/20'
                    : 'border-[#5F2427]/15 hover:border-[#3A5C34] hover:bg-[#3A5C34]/5'} text-gray-300 hover:text-[#3A5C34]`}
              >
                <Plus size={15} className={dragActive ? '' : 'opacity-0 group-hover/story:opacity-100'} />
                <EventFlag iso={iso} />
              </button>
              <span className={`text-[10px] font-semibold ${isToday ? 'text-[#e58bb8]' : 'text-gray-400'}`}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
