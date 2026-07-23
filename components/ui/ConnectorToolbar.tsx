import React, { useState } from 'react';
import { Connector, ConnectorRouting, ConnectorLineStyle } from '../../types';
import { Trash2, Spline, Minus, Waypoints, Palette } from 'lucide-react';
import { ToolButton, ToolDivider, ToolSelect, ToolSwatch, ToolMenuItem } from './toolbarKit';

const PALETTE = ['#5F2427', '#3A5C34', '#FFD753', '#FCCAE2', '#F9E6D1', '#007AFF', '#FF3B30', '#8E8E93'];
const WIDTHS = [1, 2, 3, 4];
const LINE_STYLES: { id: ConnectorLineStyle; label: string }[] = [
  { id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }, { id: 'dotted', label: 'Dotted' },
];
const ROUTINGS: { id: ConnectorRouting; label: string; Icon: React.FC<any> }[] = [
  { id: 'bezier', label: 'Curved', Icon: Spline },
  { id: 'straight', label: 'Straight', Icon: Minus },
  { id: 'orthogonal', label: 'Right-angle', Icon: Waypoints },
];

interface Props {
  connector: Connector;
  onChange: (patch: Partial<Connector>) => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}

export const ConnectorToolbar: React.FC<Props> = ({ connector, onChange, onDelete, style }) => {
  const [menu, setMenu] = useState<null | 'weight' | 'color' | 'style' | 'route'>(null);
  const toggle = (m: typeof menu) => setMenu(menu === m ? null : m);

  const width = connector.width || 2;
  const color = connector.color || '#5F2427';
  const lineStyle = connector.lineStyle || 'solid';
  const routing = connector.routing || 'bezier';
  const RouteIcon = ROUTINGS.find(r => r.id === routing)?.Icon || Spline;

  const linePreview = (w: number, dash?: string) => (
    <svg width="34" height="10" className="shrink-0"><line x1="1" y1="5" x2="33" y2="5" stroke="currentColor" strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" /></svg>
  );

  return (
    <div
      className="no-drag absolute z-[120] -translate-x-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 px-1.5 py-1"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Weight */}
      <ToolSelect open={menu === 'weight'} onToggle={() => toggle('weight')} width="w-32" label={linePreview(width)}>
        {WIDTHS.map(w => (
          <ToolMenuItem key={w} active={width === w} onClick={() => { onChange({ width: w }); setMenu(null); }}>
            <span className="text-gray-700">{linePreview(w)}</span>
          </ToolMenuItem>
        ))}
      </ToolSelect>

      <ToolDivider />

      {/* Color */}
      <ToolSwatch open={menu === 'color'} onToggle={() => toggle('color')} color={color} icon={<Palette size={14} />} palette={PALETTE} onPick={(c) => { onChange({ color: c }); setMenu(null); }} title="Color" />

      <ToolDivider />

      {/* Line style */}
      <ToolSelect open={menu === 'style'} onToggle={() => toggle('style')} width="w-36" label={LINE_STYLES.find(s => s.id === lineStyle)?.label}>
        {LINE_STYLES.map(s => (
          <ToolMenuItem key={s.id} active={lineStyle === s.id} onClick={() => { onChange({ lineStyle: s.id }); setMenu(null); }}>
            <span className="flex items-center gap-2 text-gray-700">{linePreview(2, s.id === 'dashed' ? '6 4' : s.id === 'dotted' ? '1 4' : undefined)} {s.label}</span>
          </ToolMenuItem>
        ))}
      </ToolSelect>

      <ToolDivider />

      {/* Routing */}
      <ToolSelect open={menu === 'route'} onToggle={() => toggle('route')} width="w-40" label={<RouteIcon size={14} />}>
        {ROUTINGS.map(r => (
          <ToolMenuItem key={r.id} active={routing === r.id} onClick={() => { onChange({ routing: r.id }); setMenu(null); }}>
            <span className="flex items-center gap-2"><r.Icon size={14} /> {r.label}</span>
          </ToolMenuItem>
        ))}
      </ToolSelect>

      <ToolDivider />

      {/* Label */}
      <input
        value={connector.label || ''}
        dir="auto"
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label…"
        className="h-8 w-24 px-2 text-[12px] text-gray-700 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-[#3A5C34]/20 outline-none"
      />

      <ToolDivider />

      <ToolButton onClick={onDelete} title="Delete connector"><Trash2 size={14} /></ToolButton>
    </div>
  );
};
