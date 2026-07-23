import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardData, CardType } from '../types';
import { SharedBrandRef, SharedBrandData, loadComments, postComment, loadMembers, subscribeBrand, BrandCommentRow, nameFromEmail } from '../services/teamsBackend';
import { FeedChannel, collectFeedItems, orderedFeedItems } from '../services/feedPlanner';
import { resolveMockupProfile } from '../services/mockupProfile';
import { parseMentionQuery, insertMention, initials, ROLE_LABEL } from '../services/brandMembers';
import { FeedProfilePreview } from './FeedProfilePreview';
import { InstagramPreviewModal } from './modals/InstagramPreviewModal';
import { ReelsPreviewModal } from './modals/ReelsPreviewModal';
import { Instagram, Music2, Eye, LogOut, Send, MessageSquare, AtSign } from 'lucide-react';

// The member's read-only view of a brand shared with them (Teams Phase 2). It
// renders ONLY the owner-published mirror (SharedBrandData) — never the member's
// own file_system — so nothing here can write structural data. The member can
// browse the feed (per channel), open any post's mockup, and comment/@mention.

interface Props {
  shared: SharedBrandRef;
  data: SharedBrandData;
  me: { name: string; avatarUrl?: string };
  onExit: () => void;
}

const CHANNELS: { id: FeedChannel; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'tiktok', label: 'TikTok', Icon: Music2 },
];

const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? t : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${t}`;
};

export const SharedBrandView: React.FC<Props> = ({ shared, data, me, onExit }) => {
  const [channel, setChannel] = useState<FeedChannel>('instagram');
  const [preview, setPreview] = useState<CardData | null>(null);
  const [comments, setComments] = useState<BrandCommentRow[]>([]);
  const [roster, setRoster] = useState<{ id: string; name: string; role: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const profile = useMemo(
    () => resolveMockupProfile(data.brand?.socialProfiles?.[channel], { brandName: data.brand?.name, avatarUrl: data.brand?.avatarUrl }),
    [data.brand, channel],
  );
  const items = useMemo(() => orderedFeedItems(collectFeedItems(data.nodes || {}, 'all', channel)), [data.nodes, channel]);
  const canComment = shared.role !== 'viewer';

  const reloadComments = () => loadComments(shared.sharedBrandId).then(setComments);
  useEffect(() => {
    reloadComments();
    loadMembers(shared.sharedBrandId).then(rows => setRoster(rows.map(r => ({ id: r.user_id, name: nameFromEmail(r.email), role: r.role }))));
    const unsub = subscribeBrand(shared.sharedBrandId, { onComment: reloadComments });
    return () => unsub();
  }, [shared.sharedBrandId]);

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return roster.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [roster, mentionQuery]);

  const pickMention = (m: { id: string; name: string }) => {
    const el = taRef.current;
    const caret = el ? el.selectionStart : draft.length;
    const { text, caret: next } = insertMention(draft, caret, { id: m.id, name: m.name, email: '', role: 'commenter', status: 'active' });
    setDraft(text); setPending(p => [...p, m.id]); setMentionQuery(null);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(next, next); } });
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !canComment) return;
    const mentions = [...new Set(pending.filter(id => { const m = roster.find(x => x.id === id); return m && text.includes(`@${m.name}`); }))];
    setDraft(''); setPending([]); setMentionQuery(null);
    await postComment(shared.sharedBrandId, { text, mentions, authorName: me.name, authorAvatar: me.avatarUrl });
    reloadComments();
  };

  const renderText = (text: string): React.ReactNode => {
    if (!roster.length) return text;
    const names = [...roster].sort((a, b) => b.name.length - a.name.length).map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`@(${names.join('|')})`, 'g');
    const out: React.ReactNode[] = []; let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(text))) { if (m.index > last) out.push(text.slice(last, m.index)); out.push(<span key={i++} className="font-semibold text-[#3A5C34] bg-[#3A5C34]/10 rounded px-1">{m[0]}</span>); last = m.index + m[0].length; }
    if (last < text.length) out.push(text.slice(last));
    return out.length ? out : text;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F8F6]">
      {/* Top bar — clearly a read-only shared view */}
      <div className="shrink-0 flex items-center gap-3 px-6 h-14 bg-white border-b border-[#5F2427]/10">
        <div className="w-8 h-8 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0">
          {data.brand?.avatarUrl ? <img src={data.brand.avatarUrl} className="w-full h-full rounded-xl object-cover" /> : <Eye size={16} />}
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[#5F2427] leading-tight truncate">{data.brand?.name || shared.name}</div>
          <div className="text-[11px] text-[#5F2427]/50 leading-tight flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1"><Eye size={11} /> Shared with you · view only</span>
            <span className="px-1.5 rounded-full bg-[#FFD753]/40 text-[#5F2427] font-bold">{ROLE_LABEL[shared.role]}</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden h-9">
          {CHANNELS.map((c, i) => (
            <button key={c.id} onClick={() => setChannel(c.id)} className={`px-3 h-full text-[12px] font-medium flex items-center gap-1.5 ${i === 0 ? 'border-r border-gray-100' : ''} ${channel === c.id ? 'bg-gray-50 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
              <c.Icon size={14} /> {c.label}
            </button>
          ))}
        </div>
        <button onClick={onExit} className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-white border border-[#5F2427]/10 text-[13px] font-semibold text-[#5F2427] hover:bg-gray-50 transition-colors"><LogOut size={14} /> Exit</button>
      </div>

      {/* Content — read-only feed + comments */}
      <div className="flex-1 min-h-0 flex gap-4 p-6">
        <aside className="relative w-[380px] shrink-0 bg-white rounded-2xl shadow-sm border border-[#5F2427]/10 overflow-hidden">
          <FeedProfilePreview channel={channel} profile={profile} seed={data.brand?.name} items={items} onOpen={setPreview} />
        </aside>

        {/* Comments */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-[#5F2427]/10 flex flex-col overflow-hidden">
          <div className="shrink-0 px-5 h-12 flex items-center gap-2 border-b border-gray-100">
            <MessageSquare size={16} className="text-[#3A5C34]" />
            <span className="text-[14px] font-bold text-gray-900">Comments</span>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-2">
            {comments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                <MessageSquare size={26} className="mb-2 opacity-20" />
                <p className="text-[13px] font-semibold text-gray-500">No comments yet</p>
                {canComment && <p className="text-[12px]">Leave feedback for the team below</p>}
              </div>
            ) : comments.map(c => (
              <div key={c.id} className="rounded-2xl bg-[#F9F8F6] p-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {c.author_avatar ? <img src={c.author_avatar} className="w-full h-full object-cover" /> : initials(c.author_name || 'U')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-bold text-gray-800 truncate">{c.author_name || 'Someone'}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{when(c.created_at)}</span>
                    </div>
                    <p dir="auto" className="text-[13px] text-gray-700 leading-snug mt-0.5 whitespace-pre-wrap break-words">{renderText(c.text)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {canComment ? (
            <div className="shrink-0 p-3 border-t border-gray-100 relative">
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden z-20">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 text-[11px] font-semibold text-gray-400"><AtSign size={13} className="text-[#3A5C34]" /> Mention</div>
                  <div className="max-h-48 overflow-y-auto no-scrollbar p-1.5">
                    {mentionResults.map(m => (
                      <button key={m.id} onClick={() => pickMention(m)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#3A5C34]/[0.06] text-left">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white text-[10px] font-bold flex items-center justify-center">{initials(m.name)}</span>
                        <span className="text-[13px] font-semibold text-gray-800 truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2 bg-[#F9F8F6] rounded-2xl border border-gray-200 p-1.5 focus-within:border-[#3A5C34]/40">
                <textarea
                  ref={taRef} value={draft} dir="auto" rows={1} placeholder="Write a comment… (@ to mention)"
                  onChange={e => { setDraft(e.target.value); setMentionQuery(roster.length ? parseMentionQuery(e.target.value, e.target.selectionStart) : null); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                  onKeyDown={e => {
                    if (mentionQuery !== null && mentionResults.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMention(mentionResults[0]); return; }
                    if (e.key === 'Escape' && mentionQuery !== null) { e.preventDefault(); setMentionQuery(null); return; }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] leading-snug py-1.5 max-h-[120px] placeholder-gray-400"
                />
                <button onClick={send} disabled={!draft.trim()} className="shrink-0 w-8 h-8 rounded-xl bg-[#3A5C34] text-white flex items-center justify-center hover:bg-[#2d4a29] disabled:opacity-30 transition-all"><Send size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 p-3 border-t border-gray-100 text-center text-[12px] text-gray-400">You have view-only access</div>
          )}
        </div>
      </div>

      {preview && preview.type === 'REELS' && <ReelsPreviewModal reel={preview} onClose={() => setPreview(null)} brandName={profile.displayName} username={profile.username} avatarUrl={profile.avatarUrl} />}
      {preview && preview.type !== 'REELS' && <InstagramPreviewModal post={preview} onClose={() => setPreview(null)} brandName={profile.displayName} username={profile.username} avatarUrl={profile.avatarUrl} />}
      {/* Stories open in the IG story viewer; a story card has frames. */}
    </div>
  );
};
