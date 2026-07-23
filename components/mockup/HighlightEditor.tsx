import React, { useRef, useState, useEffect } from 'react';
import { MockupHighlight, MediaItem } from '../../types';
import { PhoneSheet, SheetField } from './PhoneSheet';
import { uploadOptimistic, mediaKind, newId } from './mockupUpload';
import { Camera, Plus, Trash2, X, Play } from 'lucide-react';
import { VideoThumb } from '../media/VideoThumb';

/**
 * Story-highlight editor inside the phone mockup: title, cover image, and the
 * content that plays when the highlight is tapped.
 *
 * Every change commits upward immediately (there is no Cancel): media arrives
 * from an async upload, so a Cancel/Done model would either drop a finished
 * upload or persist a dead blob: URL if the sheet closed first.
 *
 * The highlight is held in LOCAL state and mutated through functional updates —
 * several files can upload at once, and each resolves at its own time, so a
 * callback that closed over a stale copy would silently drop the other frames.
 */
export const HighlightEditor: React.FC<{
  highlight: MockupHighlight;
  onCommit: (h: MockupHighlight) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ highlight, onCommit, onDelete, onClose }) => {
  const [h, setH] = useState<MockupHighlight>(highlight);
  const coverRef = useRef<HTMLInputElement>(null);
  const framesRef = useRef<HTMLInputElement>(null);
  const frames: MediaItem[] = h.frames || [];

  // Push every local change upward (after render — never inside an updater).
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => { commitRef.current(h); }, [h]);

  const pickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadOptimistic(file, (url) => setH(prev => ({ ...prev, coverUrl: url })));
  };

  const addFrames = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach(file => {
      const id = newId('hf');
      const type = mediaKind(file);
      // First call = instant preview (appends), later call = swap that item's url.
      uploadOptimistic(
        file,
        (url) => setH(prev => {
          const list = prev.frames || [];
          return {
            ...prev,
            frames: list.some(f => f.id === id)
              ? list.map(f => (f.id === id ? { ...f, url } : f))
              : [...list, { id, type, url }],
          };
        }),
        (thumbnail) => setH(prev => ({
          ...prev,
          frames: (prev.frames || []).map(f => (f.id === id ? { ...f, thumbnail } : f)),
        })),
      );
    });
  };

  const removeFrame = (id: string) => setH(prev => ({ ...prev, frames: (prev.frames || []).filter(f => f.id !== id) }));

  return (
    <PhoneSheet title="Highlight" onCancel={onClose} cancelLabel="Close">
      <div className="py-5 flex flex-col items-center gap-2">
        <button
          onClick={() => coverRef.current?.click()}
          className="relative w-[88px] h-[88px] rounded-full overflow-hidden border border-[#DBDBDB] bg-neutral-50 flex items-center justify-center text-neutral-300 group"
        >
          {h.coverUrl
            ? <img src={h.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Camera size={26} />}
          <span className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={20} />
          </span>
        </button>
        <button onClick={() => coverRef.current?.click()} className="text-[14px] font-semibold text-[#0095F6] hover:opacity-70">
          {h.coverUrl ? 'Change cover' : 'Add cover'}
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={pickCover} />
      </div>

      <SheetField label="Title" value={h.title} onChange={(v) => setH(prev => ({ ...prev, title: v }))} placeholder="Highlight name" />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8E8E8E]">Content</span>
          <span className="text-[11px] text-[#8E8E8E]">{frames.length} {frames.length === 1 ? 'item' : 'items'}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {frames.map(f => (
            <div key={f.id} className="relative aspect-[9/16] rounded-md overflow-hidden bg-neutral-100 group">
              {f.type === 'video'
                ? <VideoThumb url={f.url} thumbnail={f.thumbnail} />
                : <img src={f.url} alt="" className="w-full h-full object-cover" />}
              {f.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center text-white/90 pointer-events-none"><Play size={14} className="fill-white/80" /></span>
              )}
              <button
                onClick={() => removeFrame(f.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={() => framesRef.current?.click()}
            className="aspect-[9/16] rounded-md border-2 border-dashed border-[#DBDBDB] flex items-center justify-center text-[#B0B0B0] hover:border-[#3A5C34] hover:text-[#3A5C34] transition-colors"
            aria-label="Add content"
          >
            <Plus size={16} />
          </button>
        </div>
        <input ref={framesRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={addFrames} />
        <p className="mt-2 text-[11px] text-[#8E8E8E]">Tap the highlight in the profile to play it.</p>
      </div>

      <div className="px-4 pb-6">
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full h-9 rounded-lg border border-[#EFEFEF] text-[13px] font-semibold text-[#ED4956] flex items-center justify-center gap-1.5 hover:bg-[#ED4956]/5 transition-colors"
        >
          <Trash2 size={14} /> Delete highlight
        </button>
      </div>
    </PhoneSheet>
  );
};
