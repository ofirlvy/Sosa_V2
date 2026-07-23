import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, DocCardContent, Comment } from '../../types';
import {
  FileText, Download, UserPlus, FileDown, FileType2, Printer
} from 'lucide-react';
import { exportTxt, exportDocx, exportPdf, printDoc } from '../../services/docExport';
import { SelectionPopover } from '../ui/SelectionPopover';
import { useIsCardFullscreen, AssigneeStack } from './cardKit';
import { RichTextControls, richTextStyles, checklistClick } from './richtext/richtext';

// Renders the formatting controls EITHER as a persistent full-width bar (fullscreen)
// or as the selection-anchored floating popover (normal). Must be a child component
// rendered inside BaseCard's children so it reads FullscreenContext correctly —
// the card body itself is the Provider's parent and would always read `false`.
const DocToolbar: React.FC<{
  editorRef: React.RefObject<HTMLDivElement>;
  controls: React.ReactNode;
  visible: boolean;
  multiSelect: boolean;
}> = ({ editorRef, controls, visible, multiSelect }) => {
  const fullscreen = useIsCardFullscreen();
  if (!visible) return null;
  if (fullscreen) {
    // Full-width docs-style bar under the fixed header (no shadow / no border ring).
    return (
      <div className="shrink-0 flex flex-wrap items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white">
        {controls}
      </div>
    );
  }
  if (multiSelect) return null;
  return <SelectionPopover editorRef={editorRef}>{controls}</SelectionPopover>;
};

interface DocCardProps {
  card: CardData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  onUpdateContent: (id: string, content: any) => void;
  /** Controlled by Canvas: fullscreen must always render the expanded editor. */
  isFullscreen?: boolean;
  /** Two-stage gesture: expand only on second click / double-click. */
  isExpanded?: boolean;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
}

export const DocCard: React.FC<DocCardProps> = (props) => {
  const { card, isSelected, isMultiSelect, onUpdateContent } = props;
  const content = card.content as DocCardContent;
  const collapsed = !props.isExpanded && !card.alwaysExpanded && !props.isFullscreen;
  
  const [title, setTitle] = useState(content.title || 'Untitled Document');
  const [body, setBody] = useState(content.body || '');
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);

  // Comments live in the board chat drawer now. NOTE: never write a local copy
  // of `comments` back into content — the drawer edits content.comments directly
  // and a stale local copy would clobber resolves (rely on the ...content spread).

  // Debounced Sync Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== content.title || body !== content.body) {
        onUpdateContent(card.id, { ...content, title, body });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, body, content, card.id, onUpdateContent]);

  // --- Rich text editor ---
  const editorRef = useRef<HTMLDivElement>(null);

  // Keep the freshest HTML in a ref so the editor can be re-seeded correctly even
  // after a remount (entering/leaving fullscreen moves the subtree into a portal).
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // Callback ref: seed innerHTML from the latest body whenever the node attaches
  // (covers initial mount AND the fullscreen remount — fixes the "text erased" bug).
  const setEditorEl = useCallback((el: HTMLDivElement | null) => {
    editorRef.current = el;
    if (el && el.innerHTML !== (bodyRef.current || '')) {
      el.innerHTML = bodyRef.current || '';
    }
  }, []);

  const syncBody = () => {
    if (editorRef.current) setBody(editorRef.current.innerHTML);
  };

  // Immediate (non-debounced) flush — used on blur so clicking the fullscreen
  // toggle (which blurs the editor) persists text BEFORE the remount.
  const flushNow = () => {
    const html = editorRef.current?.innerHTML;
    if (html == null) return;
    onUpdateContent(card.id, { ...content, title, body: html });
  };

  // Toggle a checklist item when the click lands in the checkbox zone (shared, RTL-aware).
  const handleEditorClick = (e: React.MouseEvent) => {
    if (checklistClick(editorRef.current, e)) syncBody();
  };

  // Plain-text extraction for the .txt export (keeps line breaks).
  const bodyText = () => (body || '')
    .replace(/<\/(p|div|h1|h2|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const handleExport = async (format: 'pdf' | 'docx' | 'txt' | 'print') => {
    setIsDownloadMenuOpen(false);
    try {
      if (format === 'txt') exportTxt(title, bodyText());
      else if (format === 'docx') await exportDocx(title, body);
      else if (format === 'pdf') await exportPdf(title, body);
      else if (format === 'print') printDoc(title, body);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  // Shared formatting controls — rendered either in the selection popover
  // (normal) or in the persistent full-width bar (fullscreen, doc only).
  const toolbarControls = <RichTextControls editorRef={editorRef} onSync={syncBody} />;

  if (collapsed) {
    const snippet = bodyText();
    return (
      <BaseCard {...props} title={title || 'Untitled Document'} compact icon={<FileText size={16} className="text-gray-400"/>}>
        <div className="pt-1 pointer-events-none select-none animate-in fade-in duration-300">
          {snippet
            ? <p className="text-[12px] leading-relaxed text-gray-500 line-clamp-4 whitespace-pre-wrap">{snippet}</p>
            : <p className="text-[12px] text-gray-300 italic">Empty document</p>}
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard
      {...props}
      title={title}
      icon={<FileText size={16} className="text-gray-400"/>}
    >
      <div className="flex flex-col flex-1 min-h-0 bg-white">

        {/* Formatting toolbar: full-width bar in fullscreen, selection popover otherwise.
            (A child component so it reads FullscreenContext from inside the provider.) */}
        <DocToolbar editorRef={editorRef} controls={toolbarControls} visible multiSelect={!!isMultiSelect} />

        {/* Document Header */}
        <div className="px-8 pt-8 pb-4 shrink-0">
          <input
            type="text"
            value={title}
            dir="auto"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={flushNow}
            placeholder="Document Title"
            className="w-full text-3xl font-bold text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-300 bg-transparent"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
          />
        </div>

        {/* Body: editor (comments moved to the board chat drawer) */}
        <div className="flex-1 min-h-0 flex flex-col">
            <style>{`
              .doc-editor-scroll { cursor: text; }
              ${richTextStyles('doc-editor')}
            `}</style>

            <div className="doc-editor-scroll flex-1 min-h-0 px-8 pb-8 overflow-y-auto custom-scrollbar">
              <div
                ref={setEditorEl}
                contentEditable
                suppressContentEditableWarning
                dir="auto"
                data-placeholder="Start typing..."
                onInput={syncBody}
                onBlur={() => { syncBody(); flushNow(); }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleEditorClick}
                className="doc-editor w-full min-h-full text-[15px] leading-relaxed text-gray-700"
                style={{ textAlign: 'start' }}
              />
            </div>
        </div>

        {/* Footer (Matches PostCard) */}
        <div className="h-[60px] border-t border-gray-100 flex items-center justify-between px-6 bg-white rounded-b-[24px] shrink-0">
          {/* Left: real assignees from the brand roster */}
          <AssigneeStack
            assigneeIds={content.assignees || []}
            onChange={(ids) => onUpdateContent(card.id, { ...content, assignees: ids })}
          />

          {/* Right: Tools (Download + Comments) */}
          <div className="flex items-center gap-2">
            
            {/* Download Button with Dropdown */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsDownloadMenuOpen(!isDownloadMenuOpen); }}
                className="group w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 bg-[#F2F2F7] hover:bg-gray-200"
                title="Export Document"
              >
                <Download size={18} className="text-gray-400 group-hover:text-gray-600" />
              </button>

              {isDownloadMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsDownloadMenuOpen(false); }} />
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport('docx'); }}
                      className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                    >
                      <FileText size={14} className="text-blue-500" />
                      Export as Word (.docx)
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport('pdf'); }}
                      className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                    >
                      <FileDown size={14} className="text-red-500" />
                      Export as PDF
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport('print'); }}
                      className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                    >
                      <Printer size={14} className="text-gray-500" />
                      Print
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport('txt'); }}
                      className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                    >
                      <FileType2 size={14} className="text-gray-500" />
                      Export as Text (.txt)
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

      </div>
    </BaseCard>
  );
};
