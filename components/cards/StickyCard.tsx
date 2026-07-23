import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, StickyCardContent } from '../../types';
import {
  AlignLeft, AlignCenter, AlignRight,
  Square, RectangleHorizontal, RectangleVertical, PaintBucket,
} from 'lucide-react';
import { FloatingToolbar } from '../ui/FloatingToolbar';
import { ToolButton, ToolDivider, ToolSelect, ToolSwatch, ToolMenuItem } from '../ui/toolbarKit';
import { RichTextControls, richTextStyles, seedHtml, checklistClick } from './richtext/richtext';
import { defaultAlignFor } from '../../services/textDirection';

interface StickyCardProps {
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
  { name: '"Comic Sans MS", "Chalkboard SE", sans-serif', label: 'Marker' }
];

const STICKY_COLORS = [
  '#FFF475', // Classic Yellow
  '#CCFF90', // Light Green
  '#CBF0F8', // Light Blue
  '#F28B82', // Light Red/Pink
  '#FBBC04', // Orange
  '#D7AEFB', // Light Purple
  '#E8EAED', // Gray/White
  '#000000', // Black
  '#FFFFFF', // White
];

const STICKY_SIZES = [
  { id: 'square', width: 220, height: 220, icon: <Square size={14} />, label: 'Square' },
  { id: 'wide', width: 320, height: 220, icon: <RectangleHorizontal size={14} />, label: 'Wide' },
  { id: 'tall', width: 220, height: 320, icon: <RectangleVertical size={14} />, label: 'Tall' }
];

export const StickyCard: React.FC<StickyCardProps> = (props) => {
  const { card, onUpdateContent, onResize, isSelected, isMultiSelect, isExpanded } = props;
  const content = card.content as StickyCardContent;
  const editorRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toggle = (k: string) => setOpenMenu(m => (m === k ? null : k));

  // Edit only when expanded (sole selection) — text is inert otherwise so
  // click/drag never fight text selection.
  const editable = !!isExpanded && !isMultiSelect;

  // Initialize defaults — never write textAlign (computed per-language at render).
  useEffect(() => {
    const updates: any = {};
    if (!content.fontSize) updates.fontSize = 24;
    if (!content.fontFamily) updates.fontFamily = '"Comic Sans MS", "Chalkboard SE", sans-serif'; // Default sticky font
    if (!content.shape) updates.shape = 'square';
    if (!content.color) updates.color = '#FFF475';

    if (Object.keys(updates).length > 0) {
       onUpdateContent(card.id, { ...content, ...updates });
    }
  }, []);

  // Uncontrolled editor seeded from html (fallback: escaped text) via callback ref.
  const seedRef = useRef(seedHtml(content.html, content.text));
  seedRef.current = seedHtml(content.html, content.text);
  const setEditorEl = useCallback((el: HTMLDivElement | null) => {
    (editorRef as any).current = el;
    if (el && !el.matches(':focus') && el.innerHTML !== seedRef.current) {
      el.innerHTML = seedRef.current;
    }
  }, []);

  const commit = () => {
    const el = editorRef.current;
    if (!el) return;
    onUpdateContent(card.id, { ...content, html: el.innerHTML, text: el.innerText });
  };

  // Alignment: explicit user choice wins; else auto by content language.
  const effectiveAlign = content.textAlign ?? defaultAlignFor(content.text || '');

  const updateField = (key: keyof StickyCardContent, value: any) => {
      onUpdateContent(card.id, { ...content, [key]: value });
  };

  const updateShape = (shapeId: string) => {
      const size = STICKY_SIZES.find(s => s.id === shapeId);
      if (size && onResize) {
          updateField('shape', shapeId);
          onResize(card.id, { width: size.width, height: size.height });
      }
  };

  const isEmpty = !(content.html && content.html.replace(/<[^>]*>/g, '').trim()) && !(content.text || '').trim();

  return (
    <BaseCard {...props} variant="sticky">
      <style>{richTextStyles('rt-editor')}</style>
      <div
        className="w-full flex-1 flex flex-col p-6 relative transition-colors duration-300"
        style={{ backgroundColor: content.color || '#FFF475' }}
      >
        {/* --- STICKY TOOLBAR (Sosa standard + rich formatting parity with Docs) --- */}
        {isSelected && !isMultiSelect && (
          <FloatingToolbar fullWidth={false}>
            {/* Font family */}
            <ToolSelect open={openMenu === 'font'} onToggle={() => toggle('font')} width="w-44"
              label={FONT_FAMILIES.find(f => f.name === content.fontFamily)?.label || 'Font'}>
              {FONT_FAMILIES.map(font => (
                <ToolMenuItem key={font.name} active={content.fontFamily === font.name} onClick={() => updateField('fontFamily', font.name)} style={{ fontFamily: font.name }}>
                  {font.label}
                </ToolMenuItem>
              ))}
            </ToolSelect>

            <ToolDivider />

            {/* Rich inline formatting (size, B/I/U, color, marker, lists, checklist) */}
            <RichTextControls editorRef={editorRef} onSync={commit} compact />

            <ToolDivider />

            {/* Sticky background color */}
            <ToolSwatch open={openMenu === 'bgColor'} onToggle={() => toggle('bgColor')} color={content.color}
              icon={<PaintBucket size={14} />} palette={STICKY_COLORS} cols={5} onPick={(c) => updateField('color', c)} title="Sticky color" />

            <ToolDivider />

            <ToolButton active={effectiveAlign === 'left'} onClick={() => updateField('textAlign', 'left')} title="Align left"><AlignLeft size={14} /></ToolButton>
            <ToolButton active={effectiveAlign === 'center'} onClick={() => updateField('textAlign', 'center')} title="Align center"><AlignCenter size={14} /></ToolButton>
            <ToolButton active={effectiveAlign === 'right'} onClick={() => updateField('textAlign', 'right')} title="Align right"><AlignRight size={14} /></ToolButton>

            <ToolDivider />

            {/* Shape / size preset */}
            <ToolSelect open={openMenu === 'shape'} onToggle={() => toggle('shape')} width="w-32"
              label={STICKY_SIZES.find(s => s.id === content.shape)?.icon || <Square size={14} />}>
              {STICKY_SIZES.map(s => (
                <ToolMenuItem key={s.id} active={content.shape === s.id} onClick={() => updateShape(s.id)}>
                  <span className="flex items-center gap-2">{s.icon} {s.label}</span>
                </ToolMenuItem>
              ))}
            </ToolSelect>
          </FloatingToolbar>
        )}

        {/* Content */}
        <div className={`flex-1 flex flex-col justify-center ${effectiveAlign === 'left' ? 'items-start' : effectiveAlign === 'right' ? 'items-end' : 'items-center'}`}>
            <div
            ref={setEditorEl}
            contentEditable={editable}
            dir="auto"
            suppressContentEditableWarning
            onInput={commit}
            onBlur={commit}
            onClick={(e) => { if (checklistClick(editorRef.current, e)) commit(); }}
            onMouseDown={(e) => { if (editable) e.stopPropagation(); }}
            className={`rt-editor w-full outline-none leading-snug break-words ${editable ? 'cursor-text' : 'cursor-default'}`}
            style={{
                fontFamily: content.fontFamily,
                fontSize: `${content.fontSize}px`,
                textAlign: effectiveAlign,
                color: content.textColor || '#1C1C1E',
                fontWeight: content.isBold ? 'bold' : 'normal',
                fontStyle: content.isItalic ? 'italic' : 'normal',
                textDecoration: content.isUnderline ? 'underline' : 'none',
            }}
            onKeyDown={(e) => e.stopPropagation()}
            />

            {isEmpty && !editable && (
                 <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 pointer-events-none italic whitespace-nowrap"
                    style={{
                        fontSize: `${content.fontSize}px`,
                        fontFamily: content.fontFamily
                    }}
                 >
                     Type...
                 </div>
            )}
        </div>
      </div>
    </BaseCard>
  );
};