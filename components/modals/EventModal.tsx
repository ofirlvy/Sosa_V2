import React, { useState } from 'react';
import { CalendarEvent, CalendarEventCategory } from '../../types';
import {
  X, Trash2, Rocket, Megaphone, Tag, PartyPopper, AlarmClock,
  CheckCircle2, Clapperboard, MapPin, Flag, Star, User as UserIcon
} from 'lucide-react';

// Category → label + brand color + readable text color + icon. Shared with CalendarView.
export const EVENT_CATEGORIES: { id: CalendarEventCategory; label: string; color: string; text: string; Icon: React.FC<any> }[] = [
  { id: 'launch',    label: 'Launch',    color: '#3A5C34', text: '#FFFFFF', Icon: Rocket },
  { id: 'campaign',  label: 'Campaign',  color: '#5F2427', text: '#FFFFFF', Icon: Megaphone },
  { id: 'promotion', label: 'Promotion', color: '#FCCAE2', text: '#5F2427', Icon: Tag },
  { id: 'holiday',   label: 'Holiday',   color: '#FFD753', text: '#5F2427', Icon: PartyPopper },
  { id: 'deadline',  label: 'Deadline',  color: '#FF3B30', text: '#FFFFFF', Icon: AlarmClock },
  { id: 'review',    label: 'Review',    color: '#007AFF', text: '#FFFFFF', Icon: CheckCircle2 },
  { id: 'shoot',     label: 'Shoot',     color: '#F9E6D1', text: '#5F2427', Icon: Clapperboard },
  { id: 'event',     label: 'Event',     color: '#34C759', text: '#FFFFFF', Icon: MapPin },
  { id: 'milestone', label: 'Milestone', color: '#8E8E93', text: '#FFFFFF', Icon: Flag },
  { id: 'custom',    label: 'Custom',    color: '#5F2427', text: '#FFFFFF', Icon: Star },
];

export const getEventConfig = (cat: CalendarEventCategory) =>
  EVENT_CATEGORIES.find(c => c.id === cat) || EVENT_CATEGORIES[0];

const COLOR_SWATCHES = ['#3A5C34', '#5F2427', '#FCCAE2', '#FFD753', '#F9E6D1', '#007AFF', '#FF3B30', '#8E8E93'];

// Optional, type-specific fields stored in event.meta. Config-driven so it's easy
// to extend. Each category declares which extra field kinds to show.
type ExtraKind = 'timeRange' | 'location' | 'url' | 'channels' | 'budget' | 'offer' | 'promoCode' | 'goal' | 'deliverable';

export const CATEGORY_EXTRAS: Record<CalendarEventCategory, ExtraKind[]> = {
  launch:    ['channels', 'goal', 'url'],
  campaign:  ['budget', 'channels', 'goal', 'url'],
  promotion: ['timeRange', 'offer', 'promoCode', 'channels'],
  holiday:   ['location'],
  deadline:  ['timeRange', 'deliverable', 'url'],
  review:    ['timeRange', 'url'],
  shoot:     ['timeRange', 'location', 'url'],
  event:     ['timeRange', 'location', 'url'],
  milestone: ['goal'],
  custom:    [],
};

export const CHANNEL_OPTIONS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Email', 'Ads', 'Web'];

const EXTRA_LABELS: Record<ExtraKind, string> = {
  timeRange: 'Time', location: 'Location', url: 'Link', channels: 'Channels',
  budget: 'Budget', offer: 'Offer / Discount', promoCode: 'Promo code', goal: 'Goal / KPI', deliverable: "What's due",
};

interface EventModalProps {
  event?: CalendarEvent | null;     // present ⇒ edit mode
  defaultDate?: string;             // pre-fill for quick-add (ISO yyyy-mm-dd)
  onSubmit: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, defaultDate, onSubmit, onDelete, onClose }) => {
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title || '');
  const [category, setCategory] = useState<CalendarEventCategory>(event?.category || 'launch');
  const [startDate, setStartDate] = useState(event?.startDate || defaultDate || '');
  const [isMultiDay, setIsMultiDay] = useState(!!event?.endDate);
  const [endDate, setEndDate] = useState(event?.endDate || '');
  const [description, setDescription] = useState(event?.description || '');
  const [owner, setOwner] = useState(event?.owner || '');
  const [important, setImportant] = useState(!!event?.important);
  const [color, setColor] = useState<string | undefined>(event?.color);
  const [meta, setMeta] = useState<Record<string, any>>(event?.meta || {});

  const setMetaField = (key: string, value: any) => setMeta(prev => ({ ...prev, [key]: value }));
  const toggleChannel = (ch: string) => setMeta(prev => {
    const cur: string[] = prev.channels || [];
    return { ...prev, channels: cur.includes(ch) ? cur.filter(c => c !== ch) : [...cur, ch] };
  });

  const extras = CATEGORY_EXTRAS[category];
  const inputCls = "w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none";

  const canSave = title.trim() && startDate;

  const save = () => {
    if (!canSave) return;
    // Keep dates sane: if multi-day but end < start, drop the end.
    const validEnd = isMultiDay && endDate && endDate >= startDate ? endDate : undefined;
    // Prune meta to only the active category's fields + non-empty values.
    const cleanMeta: Record<string, any> = {};
    for (const kind of extras) {
      if (kind === 'timeRange') {
        if (meta.startTime) cleanMeta.startTime = meta.startTime;
        if (meta.endTime) cleanMeta.endTime = meta.endTime;
      } else if (kind === 'channels') {
        if (meta.channels?.length) cleanMeta.channels = meta.channels;
      } else if (meta[kind]?.toString().trim()) {
        cleanMeta[kind] = meta[kind].toString().trim();
      }
    }
    onSubmit({
      title: title.trim(),
      category,
      startDate,
      endDate: validEnd,
      description: description.trim() || undefined,
      owner: owner.trim() || undefined,
      important,
      color,
      meta: Object.keys(cleanMeta).length ? cleanMeta : undefined,
    });
  };

  // Renders one extra field by kind.
  const renderExtra = (kind: ExtraKind) => {
    if (kind === 'timeRange') {
      return (
        <div key={kind}>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{EXTRA_LABELS[kind]}</label>
          <div className="flex items-center gap-2">
            <input type="time" value={meta.startTime || ''} onChange={e => setMetaField('startTime', e.target.value)} className={inputCls} />
            <span className="text-gray-400 text-[13px]">to</span>
            <input type="time" value={meta.endTime || ''} onChange={e => setMetaField('endTime', e.target.value)} className={inputCls} />
          </div>
        </div>
      );
    }
    if (kind === 'channels') {
      return (
        <div key={kind}>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{EXTRA_LABELS[kind]}</label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map(ch => {
              const on = (meta.channels || []).includes(ch);
              return (
                <button key={ch} onClick={() => toggleChannel(ch)}
                  className={`px-2.5 h-8 rounded-full text-[12px] font-semibold transition-colors ${on ? 'bg-[#3A5C34] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div key={kind}>
        <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{EXTRA_LABELS[kind]}</label>
        <input
          dir="auto"
          type={kind === 'url' ? 'url' : 'text'}
          value={meta[kind] || ''}
          onChange={e => setMetaField(kind, e.target.value)}
          placeholder={kind === 'url' ? 'https://…' : kind === 'budget' ? '$5,000' : ''}
          className={inputCls}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-[17px] font-bold text-gray-900">{isEdit ? 'Edit event' : 'New event'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Title */}
          <input
            autoFocus
            dir="auto"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            placeholder="Event title (e.g. Spring Launch)"
            className="w-full text-[18px] font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 outline-none p-0"
          />

          {/* Category */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_CATEGORIES.map(c => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[12px] font-semibold transition-all ${active ? 'shadow-sm scale-[1.03]' : 'opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: active ? c.color : `${c.color}22`, color: active ? c.text : c.color }}
                  >
                    <c.Icon size={13} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{isMultiDay ? 'Start' : 'Date'}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none"
              />
            </div>
            {isMultiDay && (
              <div className="flex-1">
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">End</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none"
                />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={isMultiDay} onChange={e => { setIsMultiDay(e.target.checked); if (e.target.checked && !endDate) setEndDate(startDate); }} className="rounded accent-[#3A5C34]" />
            Multi-day (range)
          </label>

          {/* Type-specific details */}
          {extras.length > 0 && (
            <div className="space-y-3 pt-1">
              {extras.map(renderExtra)}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Notes</label>
            <textarea
              dir="auto"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Context the team should know…"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[14px] text-gray-800 resize-none focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none"
            />
          </div>

          {/* Owner + Important */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3A5C34]/20 focus-within:border-[#3A5C34]">
              <UserIcon size={15} className="text-gray-400 shrink-0" />
              <input
                dir="auto"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="Owner (optional)"
                className="flex-1 min-w-0 bg-transparent text-[14px] text-gray-800 border-none focus:ring-0 outline-none p-0"
              />
            </div>
            <button
              onClick={() => setImportant(v => !v)}
              className={`h-10 px-3 rounded-xl border text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${important ? 'bg-[#FFD753] border-[#FFD753] text-[#5F2427]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
              title="Mark as important"
            >
              <Star size={14} className={important ? 'fill-[#5F2427]' : ''} /> Important
            </button>
          </div>

          {/* Color override */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Color</label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setColor(undefined)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${!color ? 'border-[#3A5C34] text-[#3A5C34]' : 'border-gray-200 text-gray-400'}`}
                title="Auto (by type)"
              >Auto</button>
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-gray-900' : 'border-white shadow-sm'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {isEdit && onDelete ? (
            <button onClick={onDelete} className="flex items-center gap-1.5 text-[13px] font-semibold text-red-500 hover:text-red-600">
              <Trash2 size={15} /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-10 px-4 rounded-full text-[14px] font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button
              onClick={save}
              disabled={!canSave}
              className="h-10 px-5 rounded-full bg-[#3A5C34] hover:bg-[#2d4a29] text-white text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? 'Save' : 'Add event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
