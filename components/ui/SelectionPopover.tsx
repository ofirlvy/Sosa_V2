import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SelectionPopoverProps {
  /** The contentEditable host. The popover only shows for selections inside it. */
  editorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

/**
 * Notion/Medium-style inline toolbar: appears only when there is a non-collapsed
 * text selection inside `editorRef`, anchored just above the selection (flips
 * below near the top of the viewport). Rendered in a body portal with
 * position:fixed so it works identically inline on the canvas and in fullscreen.
 * It never shows on a plain click/caret.
 */
export const SelectionPopover: React.FC<SelectionPopoverProps> = ({ editorRef, children }) => {
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const interactingRef = useRef(false);

  useEffect(() => {
    const update = () => {
      if (interactingRef.current) return; // keep open while using the toolbar
      const sel = window.getSelection();
      const editor = editorRef.current;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editor) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { setPos(null); return; }
      const GAP = 10;
      const BAR_H = 56;
      const placement: 'top' | 'bottom' = rect.top > BAR_H + GAP ? 'top' : 'bottom';
      setPos({
        top: placement === 'top' ? rect.top - GAP : rect.bottom + GAP,
        left: Math.min(Math.max(rect.left + rect.width / 2, 180), window.innerWidth - 180),
        placement,
      });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: `translate(-50%, ${pos.placement === 'top' ? '-100%' : '0'})`,
        zIndex: 10000,
      }}
      className={`no-drag animate-in fade-in duration-150 ${pos.placement === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'}`}
      // Pressing the bar must not clear the text selection.
      onMouseDown={(e) => { e.preventDefault(); interactingRef.current = true; }}
      onMouseUp={() => { interactingRef.current = false; }}
    >
      <div className="flex items-center gap-1 p-1.5 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 flex-nowrap w-max max-w-[95vw]">
        {children}
      </div>
    </div>,
    document.body
  );
};
