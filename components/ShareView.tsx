import React, { useEffect, useMemo, useState } from 'react';
import { FileSystemNode, Workspace, Position } from '../types';
import { loadSharedBoard } from '../services/supabase';
import { Canvas } from './Canvas';
import { Loader2, Eye, Link as LinkIcon } from 'lucide-react';

/**
 * Public, anonymous, READ-ONLY view of a single shared whiteboard.
 * Rendered by index.tsx when the URL has `?share=<code>` — fully bypasses auth.
 */
export const ShareView: React.FC<{ code: string }> = ({ code }) => {
  const [node, setNode] = useState<FileSystemNode | null | undefined>(undefined); // undefined = loading
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });

  // The busiest workspace (most cards) — what we open by default.
  const workspace: Workspace | null = useMemo(() => {
    const wss = node?.whiteboardData || [];
    if (!wss.length) return null;
    return wss.reduce((best, ws) => (ws.cards.length > (best?.cards.length ?? -1) ? ws : best), wss[0]);
  }, [node]);

  useEffect(() => {
    let cancelled = false;
    loadSharedBoard(code).then(n => { if (!cancelled) setNode(n); });
    return () => { cancelled = true; };
  }, [code]);

  // Center the viewport on the cards' bounding box once loaded (same as opening a board).
  useEffect(() => {
    const cards = workspace?.cards || [];
    if (cards.length === 0) return;
    const minX = Math.min(...cards.map(c => c.x));
    const minY = Math.min(...cards.map(c => c.y));
    const maxX = Math.max(...cards.map(c => c.x + (c.width || 0)));
    const maxY = Math.max(...cards.map(c => c.y + (c.height || 0)));
    setPan({ x: window.innerWidth / 2 - (minX + maxX) / 2, y: window.innerHeight / 2 - (minY + maxY) / 2 });
  }, [workspace]);

  if (node === undefined) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#F9F8F6]"><Loader2 size={32} className="text-[#3A5C34] animate-spin" /></div>;
  }

  if (node === null) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F9F8F6] text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-[#FCCAE2] text-[#5F2427] flex items-center justify-center mb-4"><LinkIcon size={26} /></div>
        <h1 className="text-[20px] font-bold text-gray-900">This link is no longer available</h1>
        <p className="text-[14px] text-gray-500 mt-1.5 max-w-sm">The board may have been unshared or the link is invalid. Ask the owner for a new link.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-[#F9F8F6]">
      <Canvas
        readOnly
        cards={workspace?.cards || []}
        onCardsChange={() => {}}
        onCardsChangeSilent={() => {}}
        activeTool="PAN"
        onToolUsed={() => {}}
        scale={scale}
        onScaleChange={setScale}
        pan={pan}
        onPanChange={setPan}
      />

      {/* Minimal viewer chrome */}
      <div className="absolute top-6 left-6 z-[50] flex items-center gap-3 pointer-events-none">
        <div className="h-10 px-4 flex items-center gap-2 rounded-xl bg-white border border-[#5F2427]/10 shadow-sm">
          <span className="text-[14px] font-bold text-[#5F2427] max-w-[260px] truncate">{node.name}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#3A5C34] bg-[#3A5C34]/10 rounded-full px-2 py-0.5"><Eye size={12} /> View only</span>
        </div>
      </div>
      <a
        href={location.origin}
        className="absolute bottom-5 right-6 z-[50] h-9 px-3.5 flex items-center gap-1.5 rounded-full bg-white border border-[#5F2427]/10 shadow-sm text-[12px] font-semibold text-gray-500 hover:text-[#5F2427] transition-colors"
      >
        Made with <span className="text-[#5F2427] font-bold">Sosa</span>
      </a>
    </div>
  );
};
