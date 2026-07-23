import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Copy, Check, Globe, Loader2 } from 'lucide-react';
import { getShareLink, createShareLink, revokeShareLink } from '../../services/supabase';

interface ShareModalProps {
  whiteboardId: string;
  boardName: string;
  onClose: () => void;
}

const shareUrlFor = (code: string) => `${location.origin}${location.pathname}?share=${code}`;

export const ShareModal: React.FC<ShareModalProps> = ({ whiteboardId, boardName, onClose }) => {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShareLink(whiteboardId).then(c => { if (!cancelled) { setCode(c); setLoading(false); } });
    return () => { cancelled = true; };
  }, [whiteboardId]);

  const toggle = async (on: boolean) => {
    setBusy(true);
    if (on) {
      const c = await createShareLink(whiteboardId);
      setCode(c);
      if (!c) alert('Could not create a share link. Please try again.');
    } else {
      await revokeShareLink(whiteboardId);
      setCode(null);
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(shareUrlFor(code)); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked */ }
  };

  const isOn = !!code;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/20 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A5C34] text-[#FFD753] flex items-center justify-center"><LinkIcon size={17} /></div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">Share board</h2>
              <p className="text-[12px] text-gray-400 truncate max-w-[260px]">{boardName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Access toggle */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOn ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'bg-gray-200 text-gray-400'}`}>
                <Globe size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 leading-tight">Anyone with the link</p>
                <p className="text-[12px] text-gray-400">View-only · no login needed</p>
              </div>
            </div>
            {loading ? (
              <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" />
            ) : (
              <button
                onClick={() => toggle(!isOn)}
                disabled={busy}
                aria-label="Toggle public link"
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 ${isOn ? 'bg-[#3A5C34]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : ''}`} />
              </button>
            )}
          </div>

          {/* Link row */}
          {isOn && code && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-white border border-gray-200 flex items-center">
                <span className="text-[13px] text-gray-600 truncate">{shareUrlFor(code)}</span>
              </div>
              <button
                onClick={copy}
                className={`h-11 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 transition-colors shrink-0 ${copied ? 'bg-[#3A5C34] text-white' : 'bg-[#5F2427] text-[#FFD753] hover:bg-[#4a1c1f]'}`}
              >
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>
          )}

          <p className="text-[12px] text-gray-400 leading-relaxed">
            {isOn
              ? 'Anyone with this link can view the board (and play its media) without signing in. They cannot edit. Turn off to revoke access.'
              : 'Turn on to create a private, view-only link you can send to anyone — clients, teammates, stakeholders — even if they don’t have a Sosa account.'}
          </p>
        </div>
      </div>
    </div>
  );
};
