import React, { useState } from 'react';
import { BrandMember, BrandRole } from '../../types';
import {
  ROLE_LABEL, ROLE_HINT, ASSIGNABLE_ROLES, initials, isValidEmail, OWNER_MEMBER_PREFIX,
} from '../../services/brandMembers';
import { X, UserPlus, ChevronDown, Users, Link2, Check } from 'lucide-react';

// Share / Members — per brand. Manage who's on THIS brand and their role; access
// is always per-brand (an individual can share one brand without exposing the
// rest). An invitation is bound to the entered email and activates automatically
// when that person signs in. A token link remains available only as a fallback.

interface MembersModalProps {
  brandName: string;
  roster: BrandMember[];        // resolved: owner first, then members
  canManage: boolean;           // current user is the owner
  /** Create an email-bound invite; returns an optional fallback link. */
  onInvite: (email: string, role: BrandRole) => Promise<string | null>;
  onChangeRole: (memberId: string, role: BrandRole) => void;
  onRemove: (memberId: string) => void;
  onClose: () => void;
}

const Avatar: React.FC<{ member: BrandMember; size?: number }> = ({ member, size = 36 }) => {
  const s = { width: size, height: size };
  if (member.avatarUrl) return <img src={member.avatarUrl} style={s} className="rounded-full object-cover bg-gray-100" alt={member.name} />;
  return <div style={s} className="rounded-full bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white flex items-center justify-center text-[12px] font-bold">{initials(member.name)}</div>;
};

const RoleSelect: React.FC<{ value: BrandRole; disabled?: boolean; onChange: (r: BrandRole) => void }> = ({ value, disabled, onChange }) => (
  <div className="relative">
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as BrandRole)}
      className="appearance-none h-8 pl-3 pr-7 rounded-lg bg-white border border-[#5F2427]/10 text-[12px] font-semibold text-[#5F2427] outline-none disabled:opacity-60 disabled:cursor-default cursor-pointer hover:bg-gray-50"
    >
      {value === 'owner'
        ? <option value="owner">Owner</option>
        : ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
    {!disabled && <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
  </div>
);

export const MembersModal: React.FC<MembersModalProps> = ({ brandName, roster, canManage, onInvite, onChangeRole, onRemove, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BrandRole>('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState('');
  const [grantedEmail, setGrantedEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const invite = async () => {
    const e = email.trim();
    if (!isValidEmail(e)) { setError('Enter a valid email'); return; }
    if (roster.some(m => m.email.toLowerCase() === e.toLowerCase())) { setError('Already on this brand'); return; }
    setBusy(true);
    const link = await onInvite(e, role);
    setBusy(false);
    if (!link) { setError('Could not create the invite — try again'); return; }
    setLastLink(link); setGrantedEmail(e.toLowerCase()); setEmail(''); setError(''); setCopied(false);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(lastLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[#F9F8F6] rounded-[24px] shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] border border-[#5F2427]/10 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#5F2427]/5 shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#3A5C34]/10 text-[#3A5C34] flex items-center justify-center shrink-0"><Users size={17} /></div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-[#5F2427] leading-tight truncate">Share “{brandName}”</div>
              <div className="text-[12px] text-[#5F2427]/50 leading-tight">People with access to this brand</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-[#5F2427]/10 text-[#5F2427]/60 hover:bg-[#FCCAE2] hover:text-[#5F2427] transition-all shrink-0"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {/* Invite */}
          {canManage && (
            <div className="bg-white rounded-2xl shadow-sm border border-[#5F2427]/10 p-3 mb-5">
              <div className="flex items-center gap-2">
                <input
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') invite(); }}
                  placeholder="Invite by email…"
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#F9F8F6] border border-[#5F2427]/10 text-[13px] text-[#5F2427] outline-none focus:border-[#3A5C34]/40"
                />
                <RoleSelect value={role} onChange={setRole} />
                <button onClick={invite} disabled={busy} className="shrink-0 h-9 px-3 rounded-lg bg-[#3A5C34] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#2d4a29] disabled:opacity-60 transition-colors">
                  <UserPlus size={14} /> {busy ? 'Granting…' : 'Grant access'}
                </button>
              </div>
              {error
                ? <p className="text-[11px] text-red-500 mt-1.5 px-1">{error}</p>
                : <p className="text-[11px] text-[#5F2427]/40 mt-1.5 px-1">{ROLE_HINT[role]} · access activates automatically when this email signs in</p>}
              {grantedEmail && (
                <div className="mt-2.5 rounded-lg bg-[#3A5C34]/[0.06] border border-[#3A5C34]/15 p-2.5">
                  <div className="flex items-start gap-2">
                    <Check size={15} className="text-[#3A5C34] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#3A5C34]">Access saved for {grantedEmail}</p>
                      <p className="text-[11px] text-[#5F2427]/55 mt-0.5">They will see only “{brandName}” automatically after signing in with this email.</p>
                    </div>
                  </div>
                  {lastLink && (
                    <button onClick={copyLink} className="mt-2 ml-6 h-7 px-2.5 rounded-md bg-white border border-[#3A5C34]/20 text-[#3A5C34] text-[11px] font-bold flex items-center gap-1.5 hover:bg-[#3A5C34]/5 transition-colors">
                      <Link2 size={12} /> {copied ? 'Fallback link copied' : 'Copy optional fallback link'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Roster */}
          <div className="space-y-1">
            {roster.map(m => {
              const isOwner = m.id.startsWith(OWNER_MEMBER_PREFIX);
              return (
                <div key={m.id} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                  <Avatar member={m} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#5F2427] truncate">{m.name}</span>
                      {isOwner && <span className="text-[10px] font-bold text-[#5F2427]/40">You</span>}
                      {m.status === 'invited' && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#FFD753]/40 text-[#5F2427]">Awaiting sign-in</span>}
                    </div>
                    <div className="text-[11px] text-[#5F2427]/40 truncate">{m.email || '—'}</div>
                  </div>
                  {canManage && !isOwner
                    ? <RoleSelect value={m.role} onChange={r => onChangeRole(m.id, r)} />
                    : <span className="text-[12px] font-semibold text-[#5F2427]/50 px-2">{ROLE_LABEL[m.role]}</span>}
                  {canManage && !isOwner && (
                    <button onClick={() => onRemove(m.id)} title="Remove" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"><X size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
