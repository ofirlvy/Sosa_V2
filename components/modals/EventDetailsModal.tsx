import React from 'react';
import { CalendarEvent } from '../../types';
import { getEventConfig } from './EventModal';
import { X, Calendar, User as UserIcon, Star } from 'lucide-react';
import { parseISODate } from '../../services/dateUtils';

// Read-only details of the calendar event(s) on a day — opened by clicking an
// event marker on a feed slot or a story-day circle. Editing stays in the
// Calendar; this just surfaces "what's happening" so you can plan around it.

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const prettyKey = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
const prettyVal = (v: any) => Array.isArray(v) ? v.join(', ') : String(v);

interface Props {
  events: CalendarEvent[];
  dateISO: string;
  onClose: () => void;
}

export const EventDetailsModal: React.FC<Props> = ({ events, dateISO, onClose }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
    <div
      onClick={e => e.stopPropagation()}
      className="bg-[#F9F8F6] rounded-[24px] shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] border border-[#5F2427]/10 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#5F2427]/5 shrink-0 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0"><Calendar size={17} /></div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#5F2427] leading-tight">{events.length > 1 ? `${events.length} events` : 'Event'}</div>
            <div className="text-[12px] text-[#5F2427]/50 leading-tight">{fmt(dateISO)}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-[#5F2427]/10 text-[#5F2427]/60 hover:bg-[#FCCAE2] hover:text-[#5F2427] transition-all shrink-0"><X size={17} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-3">
        {events.map(ev => {
          const cfg = getEventConfig(ev.category);
          const end = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : undefined;
          const metaEntries = Object.entries(ev.meta || {}).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0));
          return (
            <div key={ev.id} className="bg-white rounded-2xl shadow-sm border border-[#5F2427]/10 p-4">
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: ev.color || cfg.color, color: cfg.text }}><cfg.Icon size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-[#5F2427] leading-tight" dir="auto">{ev.title}</span>
                    {ev.important && <Star size={13} className="text-[#FFD753] fill-[#FFD753] shrink-0" />}
                  </div>
                  <div className="text-[12px] text-[#5F2427]/50 mt-0.5">
                    <span className="font-semibold" style={{ color: ev.color || cfg.color }}>{cfg.label}</span>
                    {' · '}{fmt(ev.startDate)}{end ? ` → ${fmt(end)}` : ''}
                  </div>
                </div>
              </div>
              {ev.description && <p className="text-[13px] text-[#5F2427]/80 mt-2.5 whitespace-pre-wrap break-words" dir="auto">{ev.description}</p>}
              {(ev.owner || metaEntries.length > 0) && (
                <div className="mt-2.5 pt-2.5 border-t border-[#5F2427]/5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  {ev.owner && (<><span className="text-[11px] font-semibold text-[#5F2427]/40 flex items-center gap-1"><UserIcon size={11} /> Owner</span><span className="text-[12px] text-[#5F2427]/80" dir="auto">{ev.owner}</span></>)}
                  {metaEntries.map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span className="text-[11px] font-semibold text-[#5F2427]/40">{prettyKey(k)}</span>
                      <span className="text-[12px] text-[#5F2427]/80 break-words" dir="auto">{prettyVal(v)}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
