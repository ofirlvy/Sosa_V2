import React, { useMemo, useState } from 'react';
import { CardData, CardType, PublishPlatform, PublishTarget, PostCardContent, ReelsCardContent, MediaItem } from '../../types';
import { PLATFORM_META } from '../../services/publishReminders';
import { X, CalendarClock, Instagram, Facebook, Music2, Image as ImageIcon, AlertTriangle, Check } from 'lucide-react';

// Schedule a Post/Reel to social platforms (Phase B: semi-auto — the app fires
// a reminder + Publish Kit at the chosen time; Phase C upgrades connected
// platforms to true auto-publish). Writes content.publishTargets (additive).

interface PublishModalProps {
  card: CardData;
  onSave: (targets: PublishTarget[]) => void;
  onClose: () => void;
}

const PLATFORM_ICONS: Record<PublishPlatform, React.ReactNode> = {
  instagram: <Instagram size={16} />,
  facebook: <Facebook size={16} />,
  tiktok: <Music2 size={16} />,
  pinterest: <ImageIcon size={16} />,
};

const cardMedia = (card: CardData): MediaItem[] => {
  if (card.type === CardType.REELS) {
    const cover = (card.content as ReelsCardContent).cover;
    return cover ? [cover] : [];
  }
  const pc = card.content as PostCardContent;
  return (pc.finalAssets?.length ? pc.finalAssets : pc.references) || [];
};

// Default schedule time: next round hour, tomorrow-safe if near midnight.
const defaultAt = (): string => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const PublishModal: React.FC<PublishModalProps> = ({ card, onSave, onClose }) => {
  const content = card.content as PostCardContent | ReelsCardContent;
  const existing = (content.publishTargets || []) as PublishTarget[];
  const media = cardMedia(card);
  const hasVideo = media.some(m => m.type === 'video');

  const [selected, setSelected] = useState<Set<PublishPlatform>>(
    () => new Set(existing.filter(t => t.status === 'scheduled').map(t => t.platform))
  );
  const [at, setAt] = useState<string>(() => {
    const first = existing.find(t => t.status === 'scheduled');
    return first ? first.at.slice(0, 16) : defaultAt();
  });
  const [caption, setCaption] = useState<string>(content.caption || '');

  const toggle = (p: PublishPlatform) =>
    setSelected(prev => { const n = new Set(prev); if (n.has(p)) { n.delete(p); } else { n.add(p); } return n; });

  // Per-platform readiness warnings (don't block — the user may fix the card later).
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (selected.has('instagram') && media.length === 0) w.push('Instagram needs at least one image or video on the card');
    if (selected.has('tiktok') && !hasVideo) w.push('TikTok needs a video');
    if (selected.has('pinterest') && media.length === 0) w.push('Pinterest needs an image');
    return w;
  }, [selected, media.length, hasVideo]);

  const overLimit = ([...selected] as PublishPlatform[])
    .filter(p => caption.length > PLATFORM_META[p].captionLimit);

  const save = () => {
    // Keep history (published/canceled/needs_action); replace open schedules.
    const kept = existing.filter(t => t.status !== 'scheduled');
    const atIso = new Date(at).toISOString();
    const fresh: PublishTarget[] = [...selected].map(platform => ({
      id: `pt-${platform}-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      platform,
      at: atIso,
      status: 'scheduled',
      ...(caption !== (content.caption || '') ? { caption } : {}),
    }));
    onSave([...kept, ...fresh]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm p-8" onClick={onClose}>
      <div className="relative w-full max-w-[440px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center">
              <CalendarClock size={17} />
            </div>
            <div>
              <div className="text-[15px] font-bold text-gray-900 leading-tight">Schedule publish</div>
              <div className="text-[12px] text-gray-400 leading-tight truncate max-w-[240px]" dir="auto">{(content as any).title || 'Untitled'}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Platforms */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Platforms</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PLATFORM_META) as PublishPlatform[]).map(p => {
                const active = selected.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggle(p)}
                    className={`h-11 px-3 rounded-xl border flex items-center gap-2.5 text-[13px] font-semibold transition-colors ${active ? 'border-[#3A5C34] bg-[#3A5C34]/[0.06] text-[#3A5C34]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span className={active ? 'text-[#3A5C34]' : 'text-gray-400'}>{PLATFORM_ICONS[p]}</span>
                    {PLATFORM_META[p].label}
                    {active && <Check size={14} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">You'll get a reminder with everything ready to post. Connected accounts (coming soon) will publish automatically.</p>
          </div>

          {/* When */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">When</div>
            <input
              type="datetime-local"
              value={at}
              onChange={e => setAt(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-800 focus:border-[#3A5C34] focus:ring-0 outline-none"
            />
          </div>

          {/* Caption */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Caption</div>
            <textarea
              value={caption}
              dir="auto"
              onChange={e => setCaption(e.target.value)}
              rows={4}
              placeholder="Write the caption to publish..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] leading-snug text-gray-800 focus:border-[#3A5C34] focus:ring-0 outline-none resize-none"
            />
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {([...selected] as PublishPlatform[]).map(p => (
                <span key={p} className={`text-[10px] font-semibold ${caption.length > PLATFORM_META[p].captionLimit ? 'text-red-500' : 'text-gray-400'}`}>
                  {PLATFORM_META[p].label}: {caption.length}/{PLATFORM_META[p].captionLimit}
                </span>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-xl bg-[#FFD753]/20 border border-[#FFD753]/60 p-3 space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] font-medium text-[#5F2427]">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {w}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={selected.size === 0 || !at || overLimit.length > 0}
            className="flex-1 h-10 rounded-xl bg-[#3A5C34] text-white text-[13px] font-bold hover:bg-[#2d4a29] disabled:opacity-30 transition-colors"
          >
            Schedule {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
