import React, { useState, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, StoryCardContent, MediaItem } from '../../types';
import { CirclePlay, Plus, X, Play, Clock, Calendar } from 'lucide-react';
import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { StoryPreviewModal } from '../modals/StoryPreviewModal';
import { StatusPill, CardActionBar, DateChip, StatusChip, PreviewButton } from './cardKit';
import { VideoThumb } from '../media/VideoThumb';
import { useMockupProfile } from '../../contexts/BrandIdentity';

interface StoryCardProps {
  card: CardData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  onUpdateContent: (id: string, content: any) => void;
  /** Two-stage gesture: expand only on second click / double-click. */
  isExpanded?: boolean;
  isFullscreen?: boolean;
  /** Controlled-fullscreen callback (e.g. editing from the Feed page). */
  onFullscreenChange?: (id: string, next: boolean) => void;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
}

// Big 9:16 frame slots + dynamic card growth. Adding frames widens the card up to
// 6 columns; beyond that, frames wrap to a new row and the card grows in height.
const SLOT_W = 132;
const SLOT_H = 234;
const GAP = 10;
const PAD = 20; // matches BaseCard default px-5
const HEADER_H = 150; // BaseCard label + title + date row (approx, tunable)
const FOOTER_H = 92;  // mt-8 + border + pt-4 + buttons (approx, tunable)

export const StoryCard: React.FC<StoryCardProps> = (props) => {
  const { card, isSelected, isMultiSelect, onUpdateContent, onResize } = props;
  const content = card.content as StoryCardContent;
  const frames: MediaItem[] = content.frames || [];
  const collapsed = !props.isExpanded && !card.alwaysExpanded && !props.isFullscreen;

  // Comments live in the board chat drawer; never keep a local copy (clobber risk).
  const [showPreview, setShowPreview] = useState(false);
  const storyProfile = useMockupProfile('instagram');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);

  const update = (patch: Partial<StoryCardContent>) => onUpdateContent(card.id, { ...content, ...patch });

  // --- Dynamic sizing: grow width up to 6 cols, then wrap rows and grow height ---
  const totalSlots = frames.length + 1; // include the "+" add button
  const cols = Math.min(Math.max(totalSlots, 3), 6);
  const rows = Math.ceil(totalSlots / cols);
  const gridWidth = cols * SLOT_W + (cols - 1) * GAP;
  const targetW = PAD * 2 + gridWidth;
  const targetH = HEADER_H + rows * SLOT_H + (rows - 1) * GAP + FOOTER_H;

  useEffect(() => {
    if (Math.round(card.width) !== targetW || Math.round(card.height) !== targetH) {
      onResize(card.id, { width: targetW, height: targetH });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetW, targetH]);

  const addFrames = async (files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter(f => { if (!isWithinMediaLimit(f)) { alert(mediaLimitMessage()); return false; } return true; });
    if (!allowed.length) return;

    // Optimistic: insert frames with instant local previews; upload in the background
    // and swap each in. `working` is shared across the swap closures so concurrent
    // resolutions don't clobber each other.
    const uploads = allowed.map(f => {
      const { previewUrl, promise, posterPromise } = beginMediaUpload(f);
      const item: MediaItem = {
        id: `frame-${Date.now()}-${Math.random()}`,
        type: f.type.startsWith('video') ? 'video' as const : 'image' as const,
        url: previewUrl,
        uploading: true,
      };
      return { item, previewUrl, promise, posterPromise };
    });

    let working: MediaItem[] = [...frames, ...uploads.map(u => u.item)];
    update({ frames: working });

    uploads.forEach(({ item, previewUrl, promise, posterPromise }) => {
      // Poster resolves independently of the upload — merge into the same `working`.
      posterPromise.then(thumb => {
        if (!thumb) return;
        working = working.map(fr => fr.id === item.id ? { ...fr, thumbnail: thumb } : fr);
        update({ frames: working });
      });
      promise
        .then(finalUrl => {
          working = working.map(fr => fr.id === item.id ? { ...fr, url: finalUrl, uploading: false } : fr);
          update({ frames: working });
        })
        .finally(() => { try { URL.revokeObjectURL(previewUrl); } catch { /* already revoked */ } });
    });
  };

  const removeFrame = (id: string) => update({ frames: frames.filter(f => f.id !== id) });

  // Append already-resolved media (an on-board image/video copied then pasted onto
  // the frames strip) directly by URL — no re-upload.
  const addFrameItems = (items: { type: 'image' | 'video'; url: string }[]) => {
    const usable = items.filter(it => !!it.url);
    if (!usable.length) return;
    const newFrames: MediaItem[] = usable.map((it, i) => ({
      id: `frame-${Date.now()}-${i}-${Math.round(Math.random() * 1e4)}`, type: it.type, url: it.url,
    }));
    update({ frames: [...frames, ...newFrames] });
  };

  // Paste-to-slot: Canvas dispatches `sosa:paste-media` onto the hovered frames zone.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onZone = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.items?.length) addFrameItems(d.items);
      else if (d.files?.length) addFrames(d.files as unknown as FileList);
    };
    el.addEventListener('sosa:paste-media', onZone);
    return () => el.removeEventListener('sosa:paste-media', onZone);
  });

  // Card-wide fallback: pasting media anywhere over the (expanded) card adds a frame,
  // not just over the strip. React 19 ref-cleanup rebinds with fresh state.
  const cardPasteRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.items?.length) addFrameItems(d.items);
      else if (d.files?.length) addFrames(d.files as unknown as FileList);
    };
    node.addEventListener('sosa:paste-media', handler);
    return () => node.removeEventListener('sosa:paste-media', handler);
  };

  const status = content.status || 'Idea';
  const durationSec = frames.length * 5;
  const displayDate = content.date || '';

  return (
    <BaseCard
      {...props}
      title={collapsed ? (content.title || 'Untitled Story') : 'Story Beat'}
      compact={collapsed}
      headerRight={collapsed ? (<><DateChip date={displayDate} /><StatusChip status={status} /></>) : undefined}
      icon={<CirclePlay size={16} className="text-[#5F2427]" />}
    >
      {collapsed ? (
        <div className="pt-1 pointer-events-none select-none animate-in fade-in duration-300">
          {frames.length > 0 ? (
            <div className="flex items-center gap-2">
              {frames.slice(0, 4).map(f => (
                <div key={f.id} className="w-[42px] aspect-[9/16] rounded-md overflow-hidden bg-gray-100 ring-1 ring-black/5">
                  {f.type === 'video' ? <VideoThumb url={f.url} thumbnail={f.thumbnail} /> : <img src={f.url} className="w-full h-full object-cover" />}
                </div>
              ))}
              {frames.length > 4 && <span className="text-[11px] font-bold text-gray-400">+{frames.length - 4}</span>}
            </div>
          ) : (
            <div className="w-[42px] aspect-[9/16] rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Plus size={14} /></div>
          )}
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-400 font-medium"><Clock size={12} /> {frames.length} {frames.length === 1 ? 'frame' : 'frames'} · ~{durationSec}s</div>
        </div>
      ) : (
      <div ref={cardPasteRef} data-paste-zone="frames" className="flex flex-col h-full">

        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
            {/* Title Block */}
            <div className="space-y-2">
              <input
                value={content.title || ''}
                dir="auto"
                data-card-focus
                placeholder="Untitled Story"
                onChange={(e) => update({ title: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full font-bold text-[28px] leading-tight text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 no-drag cursor-text"
              />

              {/* Date & Status Row */}
              <div className="flex items-center justify-between pt-2 pb-4">
                <div className="relative flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-all">
                  <Calendar size={13} />
                  <span className="text-[12px] font-medium text-gray-500">
                    {displayDate ? new Date(displayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}
                  </span>
                  <input
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={displayDate}
                    onChange={(e) => update({ date: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <StatusPill status={status} onChange={(s) => update({ status: s as StoryCardContent['status'] })} />
              </div>
            </div>

            {/* Frames strip — big 9:16 slots */}
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => addFrames(e.target.files)} />
            <div ref={stripRef} data-paste-zone="frames" className="flex flex-wrap content-start" style={{ width: gridWidth, gap: GAP }}>
              {frames.map(f => (
                <div key={f.id} className="relative group rounded-xl overflow-hidden bg-gray-100 ring-1 ring-black/5" style={{ width: SLOT_W, height: SLOT_H }}>
                  {f.type === 'video'
                    ? <><VideoThumb url={f.url} thumbnail={f.thumbnail} /><Play size={20} className="absolute inset-0 m-auto text-white fill-white drop-shadow" /></>
                    : <img src={f.url} className="w-full h-full object-cover" />}
                  <button onClick={(e) => { e.stopPropagation(); removeFrame(f.id); }} className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"><X size={13} strokeWidth={3} /></button>
                </div>
              ))}
              <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#5F2427] hover:text-[#5F2427] transition-colors" style={{ width: SLOT_W, height: SLOT_H }}>
                <Plus size={22} />
              </button>
            </div>
            {frames.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-400 font-medium">
                <Clock size={12} /> {frames.length} {frames.length === 1 ? 'frame' : 'frames'} · ~{durationSec}s
              </div>
            )}
        </div>

        {/* Action bar — shared kit */}
        <CardActionBar assigneeIds={content.assignees || []} onAssigneesChange={(ids) => update({ assignees: ids })}>
          <PreviewButton onClick={(e) => { e.stopPropagation(); setShowPreview(true); }} title="Preview stories" />
        </CardActionBar>
      </div>
      )}

      {showPreview && <StoryPreviewModal story={card} onClose={() => setShowPreview(false)} brandName={storyProfile.displayName} username={storyProfile.username} avatarUrl={storyProfile.avatarUrl} />}
    </BaseCard>
  );
};
