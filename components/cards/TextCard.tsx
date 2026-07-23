import React, { useState, useRef, useCallback } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, TextCardContent, TextShape } from '../../types';
import {
  Type, Square, Diamond, PaintBucket, Type as TypeIcon, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import { FloatingToolbar } from '../ui/FloatingToolbar';
import { ToolButton, ToolDivider, ToolSelect, ToolSwatch, ToolMenuItem } from '../ui/toolbarKit';
import { RichTextControls, richTextStyles, seedHtml, checklistClick } from './richtext/richtext';
import { defaultAlignFor } from '../../services/textDirection';

// --- CONSTANTS ---

const FONT_FAMILIES = [
  { name: 'Inter', label: 'Inter' },
  { name: 'Roboto', label: 'Roboto' },
  { name: 'Open Sans', label: 'Open Sans' },
  { name: 'Playfair Display', label: 'Playfair' },
  { name: 'Montserrat', label: 'Montserrat' },
  { name: 'Lato', label: 'Lato' },
  { name: 'Merriweather', label: 'Merriweather' },
  { name: 'Comic Neue', label: 'Comic' },
  { name: 'Courier Prime', label: 'Mono' },
  { name: 'Abril Fatface', label: 'Display' },
];

const PALETTE = [
  '#000000', '#545454', '#737373', '#A6A6A6', '#D9D9D9', '#FFFFFF',
  '#E03E3E', '#D9730D', '#D9B310', '#0B6E99', '#0F7B6C', '#64473A',
  '#FFB8B8', '#FAE3B3', '#FFF6CC', '#D4ECF7', '#D3F5EF', '#EADBD6'
];

const HIGHLIGHTER_PALETTE = [
  '#FFF36D', '#FFD37C', '#FF94C2', '#E19DFC', '#85E3FF', '#A8FF94',
  '#FEFFC4', '#FFE8C2', '#FFD1DC', '#EBD6FF', '#D1F4FF', '#D9FFCC',
];

const SHAPES: { id: TextShape; icon: React.ReactNode; label: string }[] = [
  { id: 'none', icon: <Type size={14} />, label: 'None' },
  { id: 'rectangle', icon: <Square size={14} />, label: 'Rect' },
  { id: 'rounded', icon: <div className="w-3.5 h-3.5 border-2 border-current rounded-md" />, label: 'Soft' },
  { id: 'pill', icon: <div className="w-4 h-3 border-2 border-current rounded-full" />, label: 'Pill' },
  { id: 'diamond', icon: <Diamond size={14} />, label: 'Diamond' },
];

interface TextCardProps {
  card: CardData;
  isSelected: boolean;
  isMultiSelect?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  /** Two-stage gesture: edit only when this card is expanded. */
  isExpanded?: boolean;
  isFullscreen?: boolean;
}

export const TextCard: React.FC<TextCardProps> = (props) => {
  const { card, onUpdateContent, isSelected, isMultiSelect, isExpanded } = props;
  const content = card.content as TextCardContent;
  const editorRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toggle = (k: string) => setOpenMenu(m => (m === k ? null : k));

  // Editable only when this is the sole, expanded selection (Miro-style: the text
  // is inert until you open the block — so click/drag never fight text selection).
  const editable = !!isExpanded && !isMultiSelect;

  // Uncontrolled editor seeded from html (fallback: escaped plain text) via a
  // callback ref, so React never reconciles user-edited DOM (the old jump/flicker
  // source). Re-seeds on remount (e.g. fullscreen portal).
  const seedRef = useRef(seedHtml(content.html, content.text));
  seedRef.current = seedHtml(content.html, content.text);
  const setEditorEl = useCallback((el: HTMLDivElement | null) => {
    (editorRef as any).current = el;
    if (el && !el.matches(':focus') && el.innerHTML !== seedRef.current) {
      el.innerHTML = seedRef.current;
    }
  }, []);

  // Persist both html (canonical) and a plain-text mirror (search/fallback).
  const commit = () => {
    const el = editorRef.current;
    if (!el) return;
    onUpdateContent(card.id, { ...content, html: el.innerHTML, text: el.innerText });
  };
  const syncNow = () => { if (editorRef.current) { /* debounce-free: commit on change */ } commit(); };

  const updateField = (key: keyof TextCardContent, value: any) => {
    onUpdateContent(card.id, { ...content, [key]: value });
  };

  // Alignment: explicit user choice wins; else auto by content language.
  const effectiveAlign = content.textAlign ?? defaultAlignFor(content.text || '');

  const getShapeStyles = () => {
    const alignClass = effectiveAlign === 'center' ? 'items-center' : (effectiveAlign === 'right' ? 'items-end' : 'items-start');
    const base = `w-full h-full flex flex-col justify-center ${alignClass} transition-all duration-200`;
    const padding = content.shape !== 'none' ? 'px-6 py-4' : 'p-0';
    let shapeClass = '';
    switch (content.shape) {
      case 'rectangle': shapeClass = 'rounded-none'; break;
      case 'rounded': shapeClass = 'rounded-2xl'; break;
      case 'pill': shapeClass = 'rounded-full'; break;
      default: shapeClass = '';
    }
    return {
      className: `${base} ${shapeClass} ${padding}`,
      style: { backgroundColor: content.highlightColor || 'transparent' },
    };
  };

  const shapeStyles = getShapeStyles();
  const isEmpty = !(content.html && content.html.replace(/<[^>]*>/g, '').trim()) && !(content.text || '').trim();

  return (
    <BaseCard {...props} variant="minimal">
      <style>{richTextStyles('rt-editor')}</style>
      <div className="relative group min-w-[20px]">

        {/* --- TEXT TOOLBAR (Sosa standard + rich formatting parity with Docs) --- */}
        {isSelected && !isMultiSelect && (
          <FloatingToolbar fullWidth={false}>
            {/* Font family (whole-block default) */}
            <ToolSelect open={openMenu === 'font'} onToggle={() => toggle('font')} width="w-44" label={content.fontFamily || 'Font'}>
              {FONT_FAMILIES.map(font => (
                <ToolMenuItem key={font.name} active={content.fontFamily === font.name} onClick={() => updateField('fontFamily', font.name)} style={{ fontFamily: font.name }}>
                  {font.label}
                </ToolMenuItem>
              ))}
            </ToolSelect>

            <ToolDivider />

            {/* Rich inline formatting (size, B/I/U, color, marker, lists, checklist) */}
            <RichTextControls editorRef={editorRef} onSync={syncNow} compact />

            <ToolDivider />

            {/* Text highlight (block) · box background */}
            <ToolSwatch open={openMenu === 'hi'} onToggle={() => toggle('hi')} color={content.textHighlightColor || 'transparent'} allowTransparent
              icon={<Highlighter size={14} />} palette={HIGHLIGHTER_PALETTE} onPick={(c) => updateField('textHighlightColor', c)} title="Highlight" />
            <ToolSwatch open={openMenu === 'box'} onToggle={() => toggle('box')} color={content.highlightColor || 'transparent'} allowTransparent
              icon={<PaintBucket size={14} />} palette={PALETTE} onPick={(c) => updateField('highlightColor', c)} title="Box color" />

            <ToolDivider />

            <ToolButton active={effectiveAlign === 'left'} onClick={() => updateField('textAlign', 'left')} title="Align left"><AlignLeft size={14} /></ToolButton>
            <ToolButton active={effectiveAlign === 'center'} onClick={() => updateField('textAlign', 'center')} title="Align center"><AlignCenter size={14} /></ToolButton>
            <ToolButton active={effectiveAlign === 'right'} onClick={() => updateField('textAlign', 'right')} title="Align right"><AlignRight size={14} /></ToolButton>

            <ToolDivider />

            {/* Shape */}
            <ToolSelect open={openMenu === 'shape'} onToggle={() => toggle('shape')} width="w-32"
              label={SHAPES.find(s => s.id === content.shape)?.icon || <Type size={14} />}>
              {SHAPES.map(s => (
                <ToolMenuItem key={s.id} active={content.shape === s.id} onClick={() => updateField('shape', s.id)}>
                  <span className="flex items-center gap-2">{s.icon} {s.label}</span>
                </ToolMenuItem>
              ))}
            </ToolSelect>
          </FloatingToolbar>
        )}

        {/* --- EDITOR CONTENT --- */}
        <div
          className={`${shapeStyles.className} ${content.shape === 'diamond' ? 'aspect-square flex items-center justify-center' : ''}`}
          style={shapeStyles.style}
        >
          <div
            ref={setEditorEl}
            contentEditable={editable}
            suppressContentEditableWarning
            dir="auto"
            onInput={syncNow}
            onBlur={commit}
            onClick={(e) => { if (checklistClick(editorRef.current, e)) syncNow(); }}
            onMouseDown={(e) => { if (editable) e.stopPropagation(); }}
            className={`rt-editor outline-none min-w-[20px] rounded-sm ${editable ? 'cursor-text' : 'cursor-default'} ${content.shape === 'diamond' ? 'transform rotate-45' : ''}`}
            style={{
              fontSize: `${content.fontSize}px`,
              fontFamily: content.fontFamily,
              textAlign: effectiveAlign,
              color: content.color,
              backgroundColor: content.textHighlightColor || 'transparent',
              fontWeight: content.isBold ? 'bold' : 'normal',
              fontStyle: content.isItalic ? 'italic' : 'normal',
              textDecoration: content.isUnderline ? 'underline' : 'none',
              lineHeight: 1.3,
              whiteSpace: 'pre-wrap',
              padding: '0px',
              display: 'inline-block',
              minWidth: '20px',
            }}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Placeholder if empty */}
        {isEmpty && !editable && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30 italic whitespace-nowrap"
            style={{ fontSize: `${content.fontSize}px` }}
          >
            Type something...
          </div>
        )}
      </div>
    </BaseCard>
  );
};
