import React, { useState, useRef, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, ReelsCardContent } from '../../types';
import { Video, Plus, Play, Music2, Zap, Calendar, Link as LinkIcon, Send } from 'lucide-react';
import { toISODate } from '../../services/dateUtils';
import { PublishModal } from '../modals/PublishModal';
import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { ReelsPreviewModal } from '../modals/ReelsPreviewModal';
import { StatusPill, CardActionBar, useAutosizeRef, DateChip, StatusChip, PreviewButton } from './cardKit';
import { VideoThumb } from '../media/VideoThumb';
import { useMockupProfile } from '../../contexts/BrandIdentity';

interface ReelsCardProps {
  card: CardData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  /** Set when this reel occupies a Feed Planner slot (date derives from the slot). */
  isLinked?: boolean;
  linkedDate?: Date;
  /** Two-stage gesture: expand only on second click / double-click. */
  isExpanded?: boolean;
  isFullscreen?: boolean;
  /** Controlled-fullscreen callback (e.g. editing from the Feed page). */
  onFullscreenChange?: (id: string, next: boolean) => void;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
  onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  onUpdateContent: (id: string, content: any) => void;
}

export const ReelsCard: React.FC<ReelsCardProps> = (props) => {
  const { card, isSelected, isMultiSelect, isLinked, linkedDate, onUpdateContent } = props;
  const content = card.content as ReelsCardContent;
  const collapsed = !props.isExpanded && !card.alwaysExpanded && !props.isFullscreen;

  // Comments live in the board chat drawer; never keep a local copy (clobber risk).
  const [showPreview, setShowPreview] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const scheduledCount = (content.publishTargets || []).filter(t => t.status === 'scheduled' || t.status === 'needs_action').length;
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRef: captionRef } = useAutosizeRef(content.caption || '');

  const update = (patch: Partial<ReelsCardContent>) => onUpdateContent(card.id, { ...content, ...patch });


  const setCover = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    if (!isWithinMediaLimit(f)) { alert(mediaLimitMessage()); return; }
    const coverId = `cover-${Date.now()}`;
    const type = f.type.startsWith('video') ? 'video' as const : 'image' as const;
    // Optimistic: show the local preview instantly, upload in the background.
    const { previewUrl, promise, posterPromise } = beginMediaUpload(f);
    // The upload and the poster resolve independently, so keep both values here
    // and always write the whole cover — neither can drop the other's result.
    let url = previewUrl;
    let thumbnail: string | undefined;
    let uploading = true;
    const writeCover = () => update({ cover: { id: coverId, type, url, thumbnail, ...(uploading ? { uploading: true } : {}) } });

    writeCover();
    posterPromise.then(t => { if (t) { thumbnail = t; writeCover(); } });
    promise
      .then(finalUrl => { url = finalUrl; uploading = false; writeCover(); })
      .finally(() => { try { URL.revokeObjectURL(previewUrl); } catch { /* already revoked */ } });
  };

  // Set the cover from already-resolved media (an on-board image/video copied then
  // pasted onto the cover) directly by URL — no re-upload.
  const setCoverItem = (items: { type: 'image' | 'video'; url: string }[]) => {
    const it = items.find(x => !!x.url);
    if (!it) return;
    update({ cover: { id: `cover-${Date.now()}`, type: it.type, url: it.url } });
  };
  const coverRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const onZone = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.items?.length) setCoverItem(d.items);
      else if (d.files?.length) setCover(d.files as unknown as FileList);
    };
    el.addEventListener('sosa:paste-media', onZone);
    return () => el.removeEventListener('sosa:paste-media', onZone);
  });

  // Card-wide fallback: pasting media anywhere over the (expanded) reel sets the
  // cover, not just over the cover button. React 19 ref-cleanup rebinds fresh.
  const cardPasteRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.items?.length) setCoverItem(d.items);
      else if (d.files?.length) setCover(d.files as unknown as FileList);
    };
    node.addEventListener('sosa:paste-media', handler);
    return () => node.removeEventListener('sosa:paste-media', handler);
  };

  const status = content.status || 'Idea';
  const platform = content.platform || 'instagram';
  const reelProfile = useMockupProfile(platform);
  // Planner-linked reels derive their date from the slot (single source of truth).
  const displayDate = linkedDate ? toISODate(linkedDate) : (content.date || '');

  return (
    <BaseCard
      {...props}
      title={collapsed ? (content.title || 'Untitled Reel') : 'Reel / TikTok'}
      compact={collapsed}
      headerRight={collapsed ? (<><DateChip date={displayDate} /><StatusChip status={status} /></>) : undefined}
      icon={isLinked ? <LinkIcon size={16} className="text-[#3A5C34]" /> : <Video size={16} className="text-[#5F2427]" />}
    >
      {collapsed ? (
        <div className="flex gap-3 pt-1 pointer-events-none select-none animate-in fade-in duration-300">
          <div className="w-[54px] aspect-[9/16] shrink-0 rounded-lg overflow-hidden bg-gray-100 ring-1 ring-black/5 flex items-center justify-center text-gray-300">
            {content.cover
              ? (content.cover.type === 'video'
                  ? <><VideoThumb url={content.cover.url} thumbnail={content.cover.thumbnail} className="absolute inset-0 w-full h-full object-cover" /><Play size={16} className="relative text-white fill-white drop-shadow" /></>
                  : <img src={content.cover.url} className="w-full h-full object-cover" />)
              : <Video size={16} />}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wide">{platform === 'tiktok' ? 'TikTok' : 'Instagram'}</span>
            {content.hook && <p className="text-[12px] font-medium text-[#854D0E] line-clamp-1">{content.hook}</p>}
            {content.caption && <p className="text-[12px] text-gray-500 line-clamp-2">{content.caption}</p>}
          </div>
        </div>
      ) : (
      <div ref={cardPasteRef} data-paste-zone="cover" className="flex flex-col h-full">

        <div className="flex gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
            {/* Left — big 9:16 video / cover */}
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setCover(e.target.files)} />
            <button
              ref={coverRef}
              data-paste-zone="cover"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              className="relative w-[150px] aspect-[9/16] shrink-0 rounded-2xl overflow-hidden bg-gray-100 ring-1 ring-black/5 flex items-center justify-center text-gray-400 hover:text-[#5F2427] transition-colors"
            >
              {content.cover
                ? (content.cover.type === 'video'
                    ? <><VideoThumb url={content.cover.url} thumbnail={content.cover.thumbnail} className="absolute inset-0 w-full h-full object-cover" /><Play size={28} className="relative text-white fill-white drop-shadow-lg" /></>
                    : <img src={content.cover.url} className="absolute inset-0 w-full h-full object-cover" />)
                : <div className="flex flex-col items-center gap-1.5"><Plus size={22} /><span className="text-[11px] font-medium">Add video</span></div>}
            </button>

            {/* Right — title, meta, fields */}
            <div className="flex-1 min-w-0 space-y-3">
              <input
                value={content.title || ''}
                dir="auto"
                data-card-focus
                placeholder="Untitled Reel"
                onChange={(e) => update({ title: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full font-bold text-[28px] leading-tight text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 no-drag cursor-text"
              />

              {/* Date + Status (matches PostCard) */}
              <div className="flex items-center justify-between">
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
                <StatusPill status={status} onChange={(s) => update({ status: s as ReelsCardContent['status'] })} />
              </div>

              {/* Platform toggle */}
              <div className="flex items-center rounded-full bg-gray-100 p-0.5 text-[11px] font-semibold w-fit">
                <button onClick={(e) => { e.stopPropagation(); update({ platform: 'instagram' }); }} className={`px-3 py-0.5 rounded-full transition-colors ${platform === 'instagram' ? 'bg-white shadow-sm text-[#5F2427]' : 'text-gray-500'}`}>IG</button>
                <button onClick={(e) => { e.stopPropagation(); update({ platform: 'tiktok' }); }} className={`px-3 py-0.5 rounded-full transition-colors ${platform === 'tiktok' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>TikTok</button>
              </div>

              {/* Hook */}
              <div className="flex items-center gap-1.5 bg-[#FFD753]/15 rounded-lg px-2.5 py-1.5">
                <Zap size={13} className="text-[#854D0E] shrink-0" />
                <input value={content.hook || ''} dir="auto" placeholder="Hook (first 3 seconds)" onChange={(e) => update({ hook: e.target.value })} onMouseDown={(e) => e.stopPropagation()} className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[12px] font-medium text-[#854D0E] placeholder-[#854D0E]/50" />
              </div>

              {/* Caption (auto-grow) */}
              <textarea
                ref={captionRef}
                value={content.caption || ''}
                dir="auto"
                placeholder="Caption..."
                rows={1}
                onChange={(e) => update({ caption: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full block resize-none overflow-hidden bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] text-gray-700 border-none focus:ring-0 placeholder-gray-400"
              />

              {/* Sound */}
              <div className="flex items-center gap-1.5 bg-[#F2F2F7] rounded-lg px-2.5 py-1.5">
                <Music2 size={13} className="text-gray-400 shrink-0" />
                <input value={content.soundName || ''} dir="auto" placeholder="Sound / audio name" onChange={(e) => update({ soundName: e.target.value })} onMouseDown={(e) => e.stopPropagation()} className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[12px] text-gray-600 placeholder-gray-400" />
              </div>
            </div>
        </div>

        {/* Action bar — shared kit */}
        <CardActionBar assigneeIds={content.assignees || []} onAssigneesChange={(ids) => update({ assignees: ids })}>
          <PreviewButton onClick={(e) => { e.stopPropagation(); setShowPreview(true); }} title="Preview reel" />
          {/* Schedule to social platforms */}
          <button
            onClick={(e) => { e.stopPropagation(); setPublishModalOpen(true); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Schedule publish"
            className={`relative w-9 h-9 rounded-full transition-all flex items-center justify-center ${scheduledCount > 0 ? 'bg-[#3A5C34] text-white' : 'bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
          >
            <Send size={16} />
            {scheduledCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FFD753] text-[#5F2427] text-[10px] font-bold flex items-center justify-center">
                {scheduledCount}
              </span>
            )}
          </button>
        </CardActionBar>
      </div>
      )}

      {showPreview && <ReelsPreviewModal reel={card} onClose={() => setShowPreview(false)} brandName={reelProfile.displayName} username={reelProfile.username} avatarUrl={reelProfile.avatarUrl} />}
      {publishModalOpen && (
        <PublishModal
          card={card}
          onSave={(targets) => update({ publishTargets: targets })}
          onClose={() => setPublishModalOpen(false)}
        />
      )}
    </BaseCard>
  );
};
