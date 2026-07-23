import React, { useState, useLayoutEffect, useContext, createContext, useRef, useCallback, RefObject } from 'react';
import { ChevronDown, UserPlus, Calendar, MessageSquare, Play, Check, Search } from 'lucide-react';
import { PostStatus, Comment, BrandMember } from '../../types';
import { useBrandMembers } from '../../contexts/BrandIdentity';
import { memberById, initials, ROLE_LABEL } from '../../services/brandMembers';

// Set by BaseCard so card chrome (e.g. the action bar) can adapt in fullscreen —
// pins the footer to the bottom of the full-screen page instead of hugging content.
export const FullscreenContext = createContext(false);
export const useIsCardFullscreen = () => useContext(FullscreenContext);

// Provided by Canvas so BaseCard can report each card's ACTUAL rendered size
// (cards auto-grow past card.height, and collapsed cards are shorter). Consumers
// (connectors, zone fitting, group bounds) read these measured rects — the
// measured size is never written back into card data.
export const CardMeasureContext = createContext<((id: string, width: number, height: number) => void) | null>(null);

/**
 * Card Design Kit — single source of truth for the shared card design language.
 *
 * Every content card (Post / Story / Reels / future) should render inside
 * `BaseCard variant="default"` (which provides px-5 pb-5 padding, the small
 * label+icon header, the #FFD753 hover ring, 24px radius, and auto-height) and
 * compose the pieces below so they stay visually identical. Don't fork these —
 * extend the kit. See memory: card_design_language.md.
 */

/** Open (unresolved) comment count for a card's comments array. */
export const openCommentCount = (comments?: Comment[]) =>
  (comments || []).filter(c => !c.resolved).length;

/**
 * Footer preview button — a single play glyph (no label), shared by Post/Reels/
 * Story so they open their mockup modal identically.
 */
export const PreviewButton: React.FC<{ onClick: (e: React.MouseEvent) => void; title?: string }> = ({ onClick, title = 'Preview' }) => (
  <button
    onClick={onClick}
    onMouseDown={(e) => e.stopPropagation()}
    title={title}
    className="w-9 h-9 rounded-full bg-[#5F2427] text-white flex items-center justify-center hover:bg-[#4a1c1e] transition-colors"
  >
    <Play size={14} className="fill-white ml-0.5" />
  </button>
);

/**
 * Footer button that opens the board chat drawer filtered to this card.
 * Replaces the old in-card comments panel — comments now live in one place.
 */
export const CommentBadge: React.FC<{ count: number; onClick: (e: React.MouseEvent) => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    onMouseDown={(e) => e.stopPropagation()}
    title="Comments"
    className="relative w-9 h-9 rounded-full bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all flex items-center justify-center"
  >
    <MessageSquare size={18} />
    {count > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#5F2427] text-[#FCCAE2] text-[10px] font-bold flex items-center justify-center">
        {count}
      </span>
    )}
  </button>
);

export const CARD_STATUSES: PostStatus[] = ['Idea', 'In Production', 'Ready', 'Scheduled', 'Published', 'Needs Review'];

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Idea': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'In Production': { bg: 'bg-blue-500', text: 'text-white' },
  'Ready': { bg: 'bg-orange-500', text: 'text-white' },
  'Scheduled': { bg: 'bg-purple-500', text: 'text-white' },
  'Published': { bg: 'bg-green-500', text: 'text-white' },
  'Needs Review': { bg: 'bg-red-500', text: 'text-white' },
};

/** The canonical status pill + dropdown (colored dots + labels). Used by all cards. */
export const StatusPill: React.FC<{ status: string; onChange: (status: string) => void }> = ({ status, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${STATUS_COLORS[status]?.bg || 'bg-gray-100'} ${STATUS_COLORS[status]?.text || 'text-gray-600'}`}
      >
        {status}
        <ChevronDown size={12} className="opacity-70" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {CARD_STATUSES.map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]?.bg}`} />
                <span className="text-gray-700">{s}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** A member's avatar — real picture or initials on a stable brand-green chip. */
export const MemberAvatar: React.FC<{ member?: BrandMember; size?: number }> = ({ member, size = 32 }) => {
  const s = { width: size, height: size };
  if (member?.avatarUrl) return <img src={member.avatarUrl} style={s} className="rounded-full border-2 border-white object-cover bg-gray-100" alt={member.name} title={member.name} />;
  return (
    <div style={s} title={member?.name} className="rounded-full border-2 border-white bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white flex items-center justify-center text-[11px] font-bold">
      {member ? initials(member.name) : '?'}
    </div>
  );
};

/**
 * Real assignee facepile + picker, sourced from the active brand's roster
 * (owner + members). Toggling writes `content.assignees` (member ids). Replaces
 * the old hardcoded "JD/SS" avatars.
 */
export const AssigneeStack: React.FC<{ assigneeIds: string[]; onChange: (ids: string[]) => void }> = ({ assigneeIds, onChange }) => {
  const roster = useBrandMembers();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const assigned = assigneeIds.map(id => memberById(roster, id)).filter(Boolean) as BrandMember[];
  const toggle = (id: string) => onChange(assigneeIds.includes(id) ? assigneeIds.filter(x => x !== id) : [...assigneeIds, id]);
  const filtered = roster.filter(m => (m.name + ' ' + m.email).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative flex items-center no-drag">
      <div className="flex items-center -space-x-2 pl-2">
        {assigned.slice(0, 4).map(m => <MemberAvatar key={m.id} member={m} />)}
        {assigned.length > 4 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold">+{assigned.length - 4}</div>
        )}
        <button
          onMouseDown={stop}
          onClick={(e) => { stop(e); setOpen(v => !v); }}
          title="Assign people"
          className="w-8 h-8 rounded-full bg-[#F2F2F7] border-2 border-white flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        >
          <UserPlus size={14} />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div onMouseDown={stop} className="absolute bottom-full left-0 mb-2 z-50 w-64 bg-white rounded-xl shadow-lg border border-[#5F2427]/10 p-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-lg bg-[#F9F8F6]">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Assign to…" className="w-full bg-transparent text-[13px] outline-none" />
            </div>
            <div className="max-h-56 overflow-y-auto no-scrollbar">
              {filtered.map(m => {
                const on = assigneeIds.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggle(m.id)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                    <MemberAvatar member={m} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-gray-800 truncate">{m.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">{ROLE_LABEL[m.role]}{m.status === 'invited' ? ' · pending' : ''}</div>
                    </div>
                    {on && <Check size={15} className="text-[#3A5C34] shrink-0" />}
                  </button>
                );
              })}
              {roster.length === 0 && (
                <p className="px-2 py-3 text-[12px] text-gray-400 text-center">No people yet.<br />Add them from <span className="font-semibold text-[#3A5C34]">Share</span>.</p>
              )}
              {roster.length > 0 && filtered.length === 0 && (
                <p className="px-2 py-3 text-[12px] text-gray-400 text-center">No match.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * The canonical bottom action bar: real assignee facepile on the left,
 * card-specific controls (Preview / schedule) passed as children on the right.
 */
export const CardActionBar: React.FC<{ children?: React.ReactNode; assigneeIds?: string[]; onAssigneesChange?: (ids: string[]) => void }> = ({ children, assigneeIds, onAssigneesChange }) => {
  const fullscreen = useIsCardFullscreen();
  return (
  <div className={`${fullscreen ? 'mt-auto' : 'mt-8'} pt-4 border-t border-gray-100 flex items-center justify-between no-drag`}>
    {onAssigneesChange
      ? <AssigneeStack assigneeIds={assigneeIds || []} onChange={onAssigneesChange} />
      : <div />}
    <div className="flex items-center gap-2">{children}</div>
  </div>
  );
};

/** Compact read-only status chip for the collapsed-card header row. */
export const StatusChip: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold leading-none ${STATUS_COLORS[status]?.bg || 'bg-gray-100'} ${STATUS_COLORS[status]?.text || 'text-gray-600'}`}>
    {status}
  </span>
);

/** Compact date chip (short format) for the collapsed-card header row. */
export const DateChip: React.FC<{ date?: string }> = ({ date }) => {
  if (!date) return null;
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold leading-none">
      <Calendar size={10} /> {label}
    </span>
  );
};

/**
 * Footer row wrapper that pins to the bottom in fullscreen (`mt-auto`) and hugs the
 * content otherwise (`mt-8`). Used by cards with a bespoke footer (e.g. PostCard).
 * Reads FullscreenContext — so it must be rendered inside the card's children.
 */
export const FullscreenFooterRow: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const fullscreen = useIsCardFullscreen();
  return (
    <div className={`${fullscreen ? 'mt-auto' : 'mt-8'} pt-4 border-t border-gray-100 flex items-center justify-between no-drag`}>
      {children}
    </div>
  );
};

/** Size a textarea to exactly fit its content. */
export const fitTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

/**
 * Auto-grow a textarea: one line when empty, growing line by line as you type.
 *
 * Returns a **callback ref**, which is the whole point. Measuring only when the
 * value changes isn't enough: a collapsed card's editor unmounts, so re-opening
 * a card mounts a fresh textarea while the text is unchanged — no effect fires,
 * and an existing multi-line caption opens clipped to one line until you type.
 * The callback ref measures the moment the element attaches.
 *
 * `ref` is also returned for callers that need the node (focus, selection).
 */
export const useAutosizeRef = (value: string) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback((el: HTMLTextAreaElement | null) => {
    ref.current = el;
    fitTextarea(el); // measure on attach — not just on value change
  }, []);
  useLayoutEffect(() => { fitTextarea(ref.current); }, [value]);
  return { ref, setRef, fit: () => fitTextarea(ref.current) };
};

/** Legacy form for callers holding their own RefObject. Prefer useAutosizeRef. */
export const useAutosize = (ref: RefObject<HTMLTextAreaElement>, value: string) => {
  useLayoutEffect(() => { fitTextarea(ref.current); });
};
