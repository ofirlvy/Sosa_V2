import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Workspace, BoardChatMessage, Comment, CardData, CardType, BrandMember } from '../types';
import {
  X, Send, Plus, Check, MessageSquare, FileText, Video, Image as ImageIcon,
  StickyNote, Type, LayoutGrid, Link as LinkIcon, Search, CornerUpRight, Mail, Bookmark, AtSign
} from 'lucide-react';
import { parseMentionQuery, insertMention, initials as memberInitials } from '../services/brandMembers';

// Board chat drawer — ONE conversation per whiteboard (all sheets). Aggregates
// two sources into a single chronological stream:
//   1. Board-level messages (FileSystemNode.boardChat) — may reference a card.
//   2. Card-anchored comments (card.content.comments) — legacy + new, shown as
//      threads tagged with their card.
// Data safety: this component only READS workspaces; mutations go through the
// callbacks (node update / updateCardComments) provided by App.

export type ChatFilter = 'all' | 'unresolved' | { cardId: string };

interface ChatItem {
  id: string;
  text: string;
  /** ISO string for new items; legacy display strings ("Just now") render as-is. */
  when: string;
  user: string;
  avatar?: string;
  cardId?: string;
  resolved: boolean;
  source: { kind: 'board' } | { kind: 'card'; workspaceId: string; cardId: string; commentId: string };
}

interface BoardChatDrawerProps {
  workspaces: Workspace[];
  messages: BoardChatMessage[];
  filter: ChatFilter;
  onFilterChange: (f: ChatFilter) => void;
  onSend: (text: string, cardId?: string, mentions?: string[]) => void;
  onToggleResolveMessage: (id: string) => void;
  onToggleResolveCardComment: (workspaceId: string, cardId: string, commentId: string) => void;
  onJumpToCard: (cardId: string) => void;
  onClose: () => void;
  /** The active brand's roster — for @mentions. */
  members?: BrandMember[];
}

const cardTypeIcon = (type: CardType, size = 13) => {
  switch (type) {
    case CardType.DOC: return <FileText size={size} />;
    case CardType.REELS: return <Video size={size} />;
    case CardType.IMAGE: return <ImageIcon size={size} />;
    case CardType.STICKY: return <StickyNote size={size} />;
    case CardType.TEXT: return <Type size={size} />;
    case CardType.GRID_PLANNER: return <LayoutGrid size={size} />;
    case CardType.LINK: return <LinkIcon size={size} />;
    case CardType.NEWSLETTER: return <Mail size={size} />;
    case CardType.REFERENCE: return <Bookmark size={size} />;
    default: return <FileText size={size} />;
  }
};

const cardTitle = (c: CardData): string => {
  const content = c.content as any;
  return content?.title || content?.name || content?.text?.slice(0, 30) || `${String(c.type).replace(/_/g, ' ').toLowerCase()}`;
};

const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}T/.test(s);

const formatWhen = (when: string): string => {
  if (!isIso(when)) return when; // legacy display string — render as-is
  const d = new Date(when);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
};

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';

export const BoardChatDrawer: React.FC<BoardChatDrawerProps> = ({
  workspaces, messages, filter, onFilterChange, onSend,
  onToggleResolveMessage, onToggleResolveCardComment, onJumpToCard, onClose, members = []
}) => {
  const [draft, setDraft] = useState('');
  const [attachedCardId, setAttachedCardId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  // @mention state: the picker opens when the caret is inside an "@query" token.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingMentions, setPendingMentions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Every card across all sheets (for the picker + reference chips).
  const allCards = useMemo(() => {
    const out: { card: CardData; wsId: string; wsName: string }[] = [];
    workspaces.forEach(w => (w.cards || []).forEach(card => {
      if (card.type === CardType.STROKE || card.type === CardType.ZONE) {
        if (card.type === CardType.ZONE) out.push({ card, wsId: w.id, wsName: w.name });
        return;
      }
      out.push({ card, wsId: w.id, wsName: w.name });
    }));
    return out;
  }, [workspaces]);
  const cardById = useMemo(() => new Map(allCards.map(e => [e.card.id, e])), [allCards]);

  // Normalize both sources into one stream.
  const items = useMemo<ChatItem[]>(() => {
    const board: ChatItem[] = messages.map(m => ({
      id: m.id, text: m.text, when: m.createdAt, user: m.user || 'You', avatar: m.avatar,
      cardId: m.cardId, resolved: !!m.resolved, source: { kind: 'board' as const },
    }));
    const cardItems: ChatItem[] = [];
    workspaces.forEach(w => (w.cards || []).forEach(card => {
      const comments = ((card.content as any)?.comments || []) as Comment[];
      comments.forEach(cm => cardItems.push({
        id: `cc-${card.id}-${cm.id}`,
        text: cm.text,
        when: cm.timestamp,
        user: cm.user || 'You',
        cardId: card.id,
        resolved: !!cm.resolved,
        source: { kind: 'card', workspaceId: w.id, cardId: card.id, commentId: cm.id },
      }));
    }));
    const all = [...board, ...cardItems];
    // ISO timestamps sort by date; legacy strings sink to the start in stable order.
    return all.sort((a, b) => {
      const ta = isIso(a.when) ? Date.parse(a.when) : 0;
      const tb = isIso(b.when) ? Date.parse(b.when) : 0;
      return ta - tb;
    });
  }, [messages, workspaces]);

  const filtered = useMemo(() => {
    if (filter === 'unresolved') return items.filter(i => !i.resolved);
    if (typeof filter === 'object') return items.filter(i => i.cardId === filter.cardId);
    return items;
  }, [items, filter]);

  // Keep pinned to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  const filterCard = typeof filter === 'object' ? cardById.get(filter.cardId) : null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    // When the drawer is filtered to a card, new messages attach to it by default.
    const cardId = attachedCardId || (typeof filter === 'object' ? filter.cardId : undefined);
    // Keep only mentions whose "@Name" survived edits.
    const mentions = [...new Set(pendingMentions.filter(id => {
      const m = members.find(x => x.id === id);
      return m && text.includes(`@${m.name}`);
    }))];
    onSend(text, cardId || undefined, mentions.length ? mentions : undefined);
    setDraft('');
    setAttachedCardId(null);
    setPendingMentions([]);
    setMentionQuery(null);
  };

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.trim().toLowerCase();
    return members.filter(m => (m.name + ' ' + m.email).toLowerCase().includes(q)).slice(0, 8);
  }, [members, mentionQuery]);

  const pickMention = (m: BrandMember) => {
    const el = taRef.current;
    const caret = el ? el.selectionStart : draft.length;
    const { text, caret: next } = insertMention(draft, caret, m);
    setDraft(text);
    setPendingMentions(prev => [...prev, m.id]);
    setMentionQuery(null);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(next, next); el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; } });
  };

  // Render message text with @mentions highlighted (roster names only).
  const renderMessageText = (text: string): React.ReactNode => {
    if (!members.length) return text;
    const names = [...members].sort((a, b) => b.name.length - a.name.length).map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`@(${names.join('|')})`, 'g');
    const out: React.ReactNode[] = [];
    let last = 0, match: RegExpExecArray | null, i = 0;
    while ((match = re.exec(text))) {
      if (match.index > last) out.push(text.slice(last, match.index));
      out.push(<span key={i++} className="font-semibold text-[#3A5C34] bg-[#3A5C34]/10 rounded px-1">{match[0]}</span>);
      last = match.index + match[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out.length ? out : text;
  };

  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = allCards.filter(e => e.card.type !== CardType.STROKE);
    if (!q) return list.slice(0, 30);
    return list.filter(e =>
      cardTitle(e.card).toLowerCase().includes(q) ||
      String(e.card.type).toLowerCase().includes(q) ||
      e.wsName.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allCards, pickerQuery]);

  const toggleResolve = (item: ChatItem) => {
    if (item.source.kind === 'board') onToggleResolveMessage(item.id);
    else onToggleResolveCardComment(item.source.workspaceId, item.source.cardId, item.source.commentId);
  };

  const CardChip: React.FC<{ cardId: string; small?: boolean }> = ({ cardId, small }) => {
    const entry = cardById.get(cardId);
    if (!entry) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onJumpToCard(cardId); }}
        title={`Jump to "${cardTitle(entry.card)}"`}
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#3A5C34]/10 text-[#3A5C34] font-semibold hover:bg-[#3A5C34]/20 transition-colors ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
      >
        {cardTypeIcon(entry.card.type, small ? 11 : 13)}
        <span className="max-w-[140px] truncate" dir="auto">{cardTitle(entry.card)}</span>
        <CornerUpRight size={small ? 10 : 11} className="opacity-60" />
      </button>
    );
  };

  const openCount = items.filter(i => !i.resolved).length;

  return (
    <div className="h-full flex flex-col bg-white font-sans">
      {/* Header — mirrors the calendar Unscheduled tray (white, gray hierarchy) */}
      <div className="px-5 pt-5 pb-3 shrink-0 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0">
              <MessageSquare size={17} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-gray-900 leading-tight">Board chat</div>
              <div className="text-[12px] text-gray-400 leading-tight">
                {openCount > 0 ? `${openCount} open` : 'All caught up'}
              </div>
            </div>
          </div>
          <button onClick={onClose} title="Close" className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Filters — subtle pills (active = green tint, like the sidebar) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'unresolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 h-7 rounded-full text-[12px] font-semibold transition-colors ${filter === f ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {f === 'all' ? 'All' : 'Unresolved'}
            </button>
          ))}
          {filterCard && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-[#3A5C34] text-white text-[12px] font-semibold">
              {cardTypeIcon(filterCard.card.type, 12)}
              <span className="max-w-[120px] truncate" dir="auto">{cardTitle(filterCard.card)}</span>
              <button onClick={() => onFilterChange('all')} className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center"><X size={11} /></button>
            </span>
          )}
        </div>
      </div>

      {/* Messages — warm-stone scroll area (ties to the board bg) with flat cards */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-[#F9F8F6] px-3 py-3 no-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-8">
            <MessageSquare size={28} className="mb-3 opacity-20" />
            <p className="text-[13px] font-semibold text-gray-500">No messages yet</p>
            <p className="text-[12px] mt-1 text-gray-400">Write below, or press <span className="font-bold text-[#3A5C34]">+</span> to comment on a card</p>
          </div>
        ) : filtered.map(item => (
          <div key={item.id} className={`group mb-2 rounded-2xl bg-white p-3 hover:bg-white transition-colors ${item.resolved ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                {item.avatar ? <img src={item.avatar} className="w-full h-full object-cover" /> : initials(item.user)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-bold text-gray-800 truncate">{item.user}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatWhen(item.when)}</span>
                </div>
                <p dir="auto" className={`text-[13px] text-gray-700 leading-snug mt-0.5 whitespace-pre-wrap break-words ${item.resolved ? 'line-through text-gray-400' : ''}`}>{renderMessageText(item.text)}</p>
                {item.cardId && (
                  <div className="mt-1.5"><CardChip cardId={item.cardId} small /></div>
                )}
              </div>
              <button
                onClick={() => toggleResolve(item)}
                title={item.resolved ? 'Reopen' : 'Resolve'}
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${item.resolved ? 'bg-[#3A5C34] text-white' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-[#3A5C34] hover:bg-[#3A5C34]/10'}`}
              >
                <Check size={13} strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="shrink-0 p-3 border-t border-gray-100 relative">
        {/* Card picker overlay */}
        {pickerOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden z-20">
            <div className="p-2.5 border-b border-gray-100 flex items-center gap-2">
              <Search size={14} className="text-gray-400 shrink-0 ml-1" />
              <input
                autoFocus
                value={pickerQuery}
                dir="auto"
                onChange={(e) => setPickerQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setPickerOpen(false); setPickerQuery(''); } }}
                placeholder="Find a card or group..."
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-[13px] p-0 placeholder-gray-400"
              />
            </div>
            <div className="max-h-56 overflow-y-auto no-scrollbar p-1.5 space-y-0.5">
              {pickerResults.length === 0 ? (
                <div className="px-4 py-5 text-center text-[12px] text-gray-400">No matching cards</div>
              ) : pickerResults.map(({ card, wsName }) => (
                <button
                  key={card.id}
                  onClick={() => { setAttachedCardId(card.id); setPickerOpen(false); setPickerQuery(''); }}
                  classNam