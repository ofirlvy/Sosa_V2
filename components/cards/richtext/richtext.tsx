import React, { useState, useEffect, RefObject } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, ListChecks, AlignLeft, AlignCenter, AlignRight,
  ChevronDown, Minus, Plus, Link as LinkIcon, Highlighter, Ban
} from 'lucide-react';

// Shared rich-text engine for contentEditable card editors (Doc / Text / Sticky).
// Extracted from DocCard so every text surface gets the same commands, checklist
// behavior and styling. The persisted HTML vocabulary (ul.doc-checklist,
// li[data-checked]) is UNCHANGED — existing documents keep working as-is.

// Flat list (Word-style). Each supports Latin + Hebrew glyphs.
export const FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Oswald', 'Merriweather', 'Playfair Display',
  'Heebo', 'Rubik', 'Assistant', 'Frank Ruhl Libre', 'Noto Sans Hebrew', 'David Libre', 'Secular One', 'Suez One',
].sort();
export const FONT_SIZES = [12, 14, 16, 18, 24, 32, 48];
// Full app palette (black + brand colors, same set as the grouping palette).
export const RICH_COLORS = ['#1C1C1E', '#5F2427', '#3A5C34', '#FFD753', '#FCCAE2', '#F9E6D1', '#007AFF', '#8E8E93'];
export const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
export const BLOCKS = [
  { label: 'Normal', tag: 'P' },
  { label: 'Heading 1', tag: 'H1' },
  { label: 'Heading 2', tag: 'H2' },
];

/**
 * Editor CSS for a given scope class (e.g. 'doc-editor', 'rt-editor').
 * Content-level class names (doc-checklist, data-checked) are shared/persisted —
 * only the outer scope varies per card type.
 */
export const richTextStyles = (scope: string) => `
  .${scope} { outline: none; cursor: text; }
  .${scope}:empty:before { content: attr(data-placeholder); color: #D1D5DB; }
  .${scope} ul { list-style: disc; padding-inline-start: 1.5em; margin: 0.4em 0; }
  .${scope} ol { list-style: decimal; padding-inline-start: 1.5em; margin: 0.4em 0; }
  /* Brand checklist */
  .${scope} ul.doc-checklist { list-style: none; padding-inline-start: 0; }
  .${scope} ul.doc-checklist li { position: relative; padding-inline-start: 1.8em; margin: 0.15em 0; }
  .${scope} ul.doc-checklist li::before {
    content: ''; position: absolute; inset-inline-start: 0; top: 0.12em;
    width: 1.05em; height: 1.05em; border: 2px solid #5F2427; border-radius: 0.3em;
    background: transparent; box-sizing: border-box; cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .${scope} ul.doc-checklist li[data-checked="true"]::before {
    background: #3A5C34; border-color: #3A5C34;
  }
  .${scope} ul.doc-checklist li[data-checked="true"]::after {
    content: ''; position: absolute; inset-inline-start: 0.36em; top: 0.2em;
    width: 0.3em; height: 0.6em; border: solid #fff; border-width: 0 2px 2px 0;
    transform: rotate(45deg); pointer-events: none;
  }
  .${scope} ul.doc-checklist li[data-checked="true"] { color: #9CA3AF; text-decoration: line-through; }
  .${scope} h1 { font-size: 1.6em; font-weight: 700; margin: 0.4em 0; }
  .${scope} h2 { font-size: 1.3em; font-weight: 600; margin: 0.4em 0; }
  .${scope} a { color: #1D4ED8; text-decoration: underline; }
`;

/** HTML to seed an editor from content: prefer rich `html`, else escape plain `text`. */
export const seedHtml = (html: string | undefined, text: string | undefined): string => {
  if (html != null && html !== '') return html;
  const t = text || '';
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
};

/** Element ancestor of the current selection matching a selector (within the editor). */
export const selectionAncestor = (editor: HTMLElement | null, selector: string): HTMLElement | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  const el = node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement;
  const match = el?.closest(selector) as HTMLElement | null;
  return match && editor?.contains(match) ? match : null;
};

export const execIn = (editor: HTMLElement | null, command: string, value?: string) => {
  editor?.focus();
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand(command, false, value);
};

/** Checklist: a <ul class="doc-checklist"> whose <li>s carry data-checked. */
export const insertChecklist = (editor: HTMLElement | null) => {
  editor?.focus();
  const existing = selectionAncestor(editor, 'ul');
  if (existing?.classList.contains('doc-checklist')) {
    // Already a checklist → turn the list off entirely.
    document.execCommand('insertUnorderedList');
  } else if (existing) {
    // Plain bullet list → convert to checklist.
    existing.classList.add('doc-checklist');
  } else {
    // No list → create one, then mark it as a checklist.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('insertUnorderedList');
    selectionAncestor(editor, 'ul')?.classList.add('doc-checklist');
  }
};

/**
 * Toggle a checklist item when a click lands in the checkbox zone (RTL-aware).
 * Returns true if the click toggled a checkbox (caller should sync + not treat
 * it as a text click).
 */
export const checklistClick = (editor: HTMLElement | null, e: React.MouseEvent): boolean => {
  const li = (e.target as HTMLElement).closest('li');
  if (!li || !li.closest('ul.doc-checklist') || !editor?.contains(li)) return false;
  const rect = li.getBoundingClientRect();
  const rtl = window.getComputedStyle(li).direction === 'rtl';
  const inZone = rtl ? e.clientX > rect.right - 28 : e.clientX < rect.left + 28;
  if (!inZone) return false;
  e.preventDefault();
  li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
  return true;
};

/** Highlighter / marker: `hiliteColor` is standard; some engines only take `backColor`. */
export const applyHighlight = (editor: HTMLElement | null, color: string) => {
  editor?.focus();
  document.execCommand('styleWithCSS', false, 'true');
  if (!document.execCommand('hiliteColor', false, color)) {
    document.execCommand('backColor', false, color);
  }
};

const stripInnerFontSize = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(e => {
    (e as HTMLElement).style.fontSize = '';
    if (e.tagName === 'FONT') e.removeAttribute('size');
  });
};

/**
 * Reliable font-size: wrap the selection in a fresh span and strip any inner
 * font-size so the new value always wins.
 *
 * List-aware: when the selection crosses <li> boundaries, extractContents()
 * would pull list structure into the span and re-insert it nested inside the
 * list — which duplicated checklist checkboxes. In that case the size is
 * applied per-<li> (wrapping each item's inline contents, so the em-sized
 * checkbox itself keeps a constant size).
 */
export const applyFontSize = (editor: HTMLElement | null, px: number) => {
  const sel = window.getSelection();
  if (!editor || !sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

  const ancEl = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement;
  const withinSingleLi = !!(ancEl?.closest('li') && editor.contains(ancEl.closest('li')!));

  if (!withinSingleLi) {
    const crossedLis = (Array.from(editor.querySelectorAll('li')) as HTMLLIElement[])
      .filter(li => range.intersectsNode(li));
    if (crossedLis.length > 0) {
      crossedLis.forEach(li => {
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        while (li.firstChild) span.appendChild(li.firstChild);
        stripInnerFontSize(span);
        li.appendChild(span);
      });
      sel.removeAllRanges();
      const r = document.createRange();
      r.setStartBefore(crossedLis[0]);
      r.setEndAfter(crossedLis[crossedLis.length - 1]);
      sel.addRange(r);
      return;
    }
  }

  const span = document.createElement('span');
  span.style.fontSize = `${px}px`;
  span.appendChild(range.extractContents());
  stripInnerFontSize(span);
  range.insertNode(span);

  // Re-select the resized content so further tweaks keep working.
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
};

// --- Toolbar primitives (shared look across Doc / Text / Sticky editors) ---

export const ToolBtn: React.FC<{ onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }> = ({ onClick, active, title, children }) => (
  <button
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {children}
  </button>
);

export const RichMenu: React.FC<{ open: boolean; onToggle: () => void; label: string; width: string; children: React.ReactNode }> = ({ open, onToggle, label, width, children }) => (
  <div className="relative shrink-0">
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className="h-8 px-2.5 rounded-lg flex items-center gap-1 hover:bg-gray-100 text-gray-700 text-[12px] font-medium shrink-0"
    >
      <span className="truncate max-w-[90px]">{label}</span> <ChevronDown size={12} className="shrink-0" />
    </button>
    {open && (
      <div className={`absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 max-h-60 overflow-y-auto no-scrollbar ${width}`}>
        {children}
      </div>
    )}
  </div>
);

/** Word-like active-state mirror for the toolbar buttons. */
export const useRichActiveStates = (editorRef: RefObject<HTMLElement>, enabled: boolean) => {
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false, checklist: false, alignLeft: false, alignCenter: false, alignRight: false });
  const [currentFont, setCurrentFont] = useState('');
  const [currentSize, setCurrentSize] = useState<number>(16);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const editor = editorRef.current;
      const sel = window.getSelection();
      if (!editor || !sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) return;
      try {
        const anchorEl = sel.anchorNode?.nodeType === Node.ELEMENT_NODE ? sel.anchorNode as Element : sel.anchorNode?.parentElement;
        const inChecklist = !!anchorEl?.closest('ul.doc-checklist');
        setActive({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          // A checklist is a <ul>, so the native insertUnorderedList state is true too —
          // show only the checklist as active when inside one.
          ul: document.queryCommandState('insertUnorderedList') && !inChecklist,
          ol: document.queryCommandState('insertOrderedList'),
          checklist: inChecklist,
          alignLeft: document.queryCommandState('justifyLeft'),
          alignCenter: document.queryCommandState('justifyCenter'),
          alignRight: document.queryCommandState('justifyRight'),
        });
        if (anchorEl) {
          const cs = window.getComputedStyle(anchorEl);
          const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
          if (fam) setCurrentFont(fam);
          const sz = Math.round(parseFloat(cs.fontSize));
          if (sz) setCurrentSize(sz);
        }
      } catch { /* queryCommandState can throw if unfocused */ }
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [enabled, editorRef]);

  return { active, currentFont, currentSize, setCurrentSize };
};

/**
 * The full formatting control strip (block style, font, size, B/I/U, color,
 * marker, lists, checklist, link, align) operating on a contentEditable editor.
 * `onSync` is called after every mutation so the host commits innerHTML.
 * `compact` drops block/font/align (for narrow toolbars like Sticky).
 */
export const RichTextControls: React.FC<{
  editorRef: RefObject<HTMLElement>;
  onSync: () => void;
  compact?: boolean;
}> = ({ editorRef, onSync, compact = false }) => {
  const [openMenu, setOpenMenu] = useState<null | 'font' | 'size' | 'block' | 'color' | 'marker'>(null);
  const { active, currentFont, currentSize, setCurrentSize } = useRichActiveStates(editorRef, true);

  const exec = (command: string, value?: string) => {
    execIn(editorRef.current, command, value);
    onSync();
    setOpenMenu(null);
  };
  const doFontSize = (px: number) => {
    setOpenMenu(null);
    applyFontSize(editorRef.current, px);
    setCurrentSize(px);
    onSync();
  };
  const doChecklist = () => {
    insertChecklist(editorRef.current);
    onSync();
    setOpenMenu(null);
  };
  const doHighlight = (color: string) => {
    applyHighlight(editorRef.current, color);
    onSync();
    setOpenMenu(null);
  };
  const insertLink = () => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url && url.trim()) exec('createLink', url.trim());
  };

  return (
    <>
      {!compact && (
        <RichMenu open={openMenu === 'block'} onToggle={() => setOpenMenu(openMenu === 'block' ? null : 'block')} label="Style" width="w-36">
          {BLOCKS.map(b => (
            <button key={b.tag} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', b.tag)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-50 rounded-md">{b.label}</button>
          ))}
        </RichMenu>
      )}

      {!compact && (
        <RichMenu open={openMenu === 'font'} onToggle={() => setOpenMenu(openMenu === 'font' ? null : 'font')} label={currentFont || 'Font'} width="w-56">
          {FONT_FAMILIES.map(f => (
            <button key={f} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('fontName', f)} style={{ fontFamily: f }} className="w-full text-left px-3 py-1.5 text-[14px] hover:bg-gray-50 rounded-md flex items-center justify-between gap-2">
              <span className="truncate">{f}</span>
              <span className="text-gray-400 text-[12px] shrink-0">Aa אבג</span>
            </button>
          ))}
        </RichMenu>
      )}

      {/* Font size: − [size] + */}
      <div className="flex items-center shrink-0">
        <ToolBtn onClick={() => doFontSize(Math.max(8, currentSize - 2))} title="Smaller"><Minus size={14} /></ToolBtn>
        <RichMenu open={openMenu === 'size'} onToggle={() => setOpenMenu(openMenu === 'size' ? null : 'size')} label={`${currentSize}`} width="w-20">
          {FONT_SIZES.map(s => (
            <button key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => doFontSize(s)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-50 rounded-md">{s} px</button>
          ))}
        </RichMenu>
        <ToolBtn onClick={() => doFontSize(currentSize + 2)} title="Larger"><Plus size={14} /></ToolBtn>
      </div>

      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

      <ToolBtn onClick={() => exec('bold')} active={active.bold} title="Bold"><Bold size={14} /></ToolBtn>
      <ToolBtn onClick={() => exec('italic')} active={active.italic} title="Italic"><Italic size={14} /></ToolBtn>
      <ToolBtn onClick={() => exec('underline')} active={active.underline} title="Underline"><Underline size={14} /></ToolBtn>

      {/* Text color */}
      <div className="relative shrink-0">
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpenMenu(openMenu === 'color' ? null : 'color')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-600" title="Text color">
          <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: 'linear-gradient(135deg,#3A5C34,#5F2427,#007AFF)' }} />
        </button>
        {openMenu === 'color' && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 grid grid-cols-4 gap-1.5 w-36">
            {RICH_COLORS.map(c => (
              <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('foreColor', c)} className="w-6 h-6 rounded-full border border-black/5 hover:scale-110 transition-transform" style={{ background: c }} title={c} />
            ))}
          </div>
        )}
      </div>

      {/* Marker / highlighter — translucent, coordinated with the text palette */}
      <div className="relative shrink-0">
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpenMenu(openMenu === 'marker' ? null : 'marker')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-600" title="Highlight">
          <Highlighter size={14} />
        </button>
        {openMenu === 'marker' && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 grid grid-cols-4 gap-1.5 w-36">
            {RICH_COLORS.map(c => (
              <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => doHighlight(hexToRgba(c, 0.33))} className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform" style={{ background: c }} title={`Highlight ${c}`} />
            ))}
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => doHighlight('transparent')} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50" title="Remove highlight">
              <Ban size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

      <ToolBtn onClick={() => exec('insertUnorderedList')} active={active.ul} title="Bulleted list"><List size={14} /></ToolBtn>
      <ToolBtn onClick={() => exec('insertOrderedList')} active={active.ol} title="Numbered list"><ListOrdered size={14} /></ToolBtn>
      <ToolBtn onClick={doChecklist} active={active.checklist} title="Checklist"><ListChecks size={14} /></ToolBtn>
      <ToolBtn onClick={insertLink} title="Insert link"><LinkIcon size={14} /></ToolBtn>

      {!compact && (
        <>
          <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
          <ToolBtn onClick={() => exec('justifyLeft')} active={active.alignLeft} title="Align left"><AlignLeft size={14} /></ToolBtn>
          <ToolBtn onClick={() => exec('justifyCenter')} active={active.alignCenter} title="Align center"><AlignCenter size={14} /></ToolBtn>
          <ToolBtn onClick={() => exec('justifyRight')} active={active.alignRight} title="Align right"><AlignRight size={14} /></ToolBtn>
        </>
      )}
    </>
  );
};
