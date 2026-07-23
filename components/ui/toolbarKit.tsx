import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Shared toolbar primitives — the single source of truth for the Sosa toolbar look
 * (matches the DocCard formatting bar). Used inside `FloatingToolbar` by the Sticky
 * and Text cards so every toolbar shares identical buttons, dropdowns and chrome.
 *
 * Dropdowns are controlled via a single `open` id (one menu open at a time). Buttons
 * preventDefault on mousedown so interacting never blurs the editor / drags the card.
 */

export const ToolButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {children}
  </button>
);

export const ToolDivider: React.FC = () => <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />;

/** Labeled dropdown (font / size / shape). `open` is controlled by the parent. */
export const ToolSelect: React.FC<{
  open: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}> = ({ open, onToggle, label, width = 'w-44', children }) => (
  <div className="relative shrink-0">
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="h-8 px-2.5 rounded-lg flex items-center gap-1 hover:bg-gray-100 text-gray-700 text-[12px] font-medium shrink-0"
    >
      <span className="truncate max-w-[90px]">{label}</span>
      <ChevronDown size={12} className="shrink-0 text-gray-400" />
    </button>
    {open && (
      <>
        <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }} />
        <div
          className={`absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 max-h-60 overflow-y-auto no-scrollbar ${width}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </>
    )}
  </div>
);

/** Color swatch dropdown (text / highlight / background). */
export const ToolSwatch: React.FC<{
  open: boolean;
  onToggle: () => void;
  color: string;
  icon: React.ReactNode;
  palette: string[];
  onPick: (c: string) => void;
  title?: string;
  allowTransparent?: boolean;
  cols?: number;
}> = ({ open, onToggle, color, icon, palette, onPick, title, allowTransparent, cols = 6 }) => (
  <div className="relative shrink-0">
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="h-8 px-2 rounded-lg flex items-center gap-1.5 hover:bg-gray-100 text-gray-600 shrink-0"
    >
      {icon}
      <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm relative overflow-hidden" style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}>
        {color === 'transparent' && <span className="absolute inset-x-0 top-1/2 h-px bg-red-400 -rotate-45" />}
      </span>
    </button>
    {open && (
      <>
        <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }} />
        <div
          className={`absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 grid gap-1.5`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: cols * 28 + 16 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {allowTransparent && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onPick('transparent'); }}
              className={`w-6 h-6 rounded-md border bg-white relative overflow-hidden hover:scale-110 transition-transform ${color === 'transparent' ? 'ring-2 ring-blue-500' : 'border-gray-200'}`}
              title="Transparent"
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-red-400 -rotate-45" />
            </button>
          )}
          {palette.map(c => (
            <button
              key={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onPick(c); }}
              className={`w-6 h-6 rounded-md border border-black/5 hover:scale-110 transition-transform shadow-sm ${color === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </>
    )}
  </div>
);

/** Menu item for ToolSelect dropdowns. */
export const ToolMenuItem: React.FC<{
  onClick: () => void;
  active?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ onClick, active, style, children }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={style}
    className={`w-full text-left px-3 py-1.5 text-[13px] rounded-md flex items-center justify-between gap-2 ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
  >
    {children}
    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
  </button>
);
