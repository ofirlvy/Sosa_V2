import React, { useState, useMemo, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, GanttCardContent, GanttViewMode } from '../../types';
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { soundService } from '../../services/soundService';

interface GanttCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRACK_COLORS = ['#3A5C34', '#FFD753', '#5F2427', '#007AFF', '#FF9500'];

export const GanttCard: React.FC<GanttCardProps> = (props) => {
  const { card, onUpdateContent, onResize } = props;
  const content = card.content as GanttCardContent;

  // Initialize Defaults
  useEffect(() => {
    if (!content.viewMode) {
      onUpdateContent(card.id, {
        title: "Campaign Timeline",
        viewMode: 'month',
        startDate: new Date().toISOString(),
        tracks: [
          { id: 't1', name: 'Social Media', color: '#3A5C34' },
          { id: 't2', name: 'Email Marketing', color: '#5F2427' }
        ]
      });
    }
  }, []);

  const currentDate = new Date(content.startDate || Date.now());

  const handleModeChange = (mode: GanttViewMode) => {
    onUpdateContent(card.id, { ...content, viewMode: mode });
    soundService.play('snap');
  };

  const shiftDate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (content.viewMode === 'month') newDate.setMonth(newDate.getMonth() + direction);
    if (content.viewMode === 'quarter') newDate.setMonth(newDate.getMonth() + (direction * 3));
    if (content.viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + direction);
    onUpdateContent(card.id, { ...content, startDate: newDate.toISOString() });
    soundService.play('toggle');
  };

  const addTrack = () => {
    const color = TRACK_COLORS[content.tracks.length % TRACK_COLORS.length];
    const newTrack = { id: `track-${Date.now()}`, name: 'New Stream', color };
    onUpdateContent(card.id, { ...content, tracks: [...content.tracks, newTrack] });
    
    // Auto-resize height to fit new track
    if (onResize) {
        onResize(card.id, { width: card.width, height: card.height + 80 }); // 80px per track approx
    }
    soundService.play('drop');
  };

  const removeTrack = (trackId: string) => {
    onUpdateContent(card.id, { ...content, tracks: content.tracks.filter(t => t.id !== trackId) });
    if (onResize) {
        onResize(card.id, { width: card.width, height: Math.max(200, card.height - 80) });
    }
  };

  const updateTrackName = (trackId: string, name: string) => {
    onUpdateContent(card.id, { 
        ...content, 
        tracks: content.tracks.map(t => t.id === trackId ? { ...t, name } : t) 
    });
  };

  // --- Grid Generation Logic ---
  const gridColumns = useMemo(() => {
    const cols = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (content.viewMode === 'month') {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            cols.push({ label: `${i}`, subLabel: '' });
        }
    } else if (content.viewMode === 'quarter') {
        // Show weeks of the quarter (approx 13 weeks)
        // Simply showing 3 months for cleaner UI
        for (let i = 0; i < 3; i++) {
            cols.push({ label: MONTHS[(month + i) % 12], subLabel: '', isMajor: true });
        }
    } else {
        // Year View (12 Months)
        for (let i = 0; i < 12; i++) {
            cols.push({ label: MONTHS[i], subLabel: '' });
        }
    }
    return cols;
  }, [content.viewMode, content.startDate]);

  const getDateLabel = () => {
    const y = currentDate.getFullYear();
    const m = MONTHS[currentDate.getMonth()];
    if (content.viewMode === 'month') return `${m} ${y}`;
    if (content.viewMode === 'quarter') return `Q${Math.floor(currentDate.getMonth() / 3) + 1} ${y}`;
    return `${y}`;
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Timeline"} 
      icon={<CalendarRange size={16} className="text-[#3A5C34]"/>}
    >
      <div className="flex flex-col h-full bg-white select-none">
        
        {/* --- Toolbar --- */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                <button onClick={() => shiftDate(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><ChevronLeft size={14}/></button>
                <span className="w-24 text-center text-[13px] font-bold text-gray-800">{getDateLabel()}</span>
                <button onClick={() => shiftDate(1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><ChevronRight size={14}/></button>
            </div>

            <div className="flex bg-gray-200/50 p-1 rounded-lg">
                {(['month', 'quarter', 'year'] as GanttViewMode[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => handleModeChange(mode)}
                        className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${content.viewMode === mode ? 'bg-white text-[#3A5C34] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>

        {/* --- Timeline Body --- */}
        <div className="flex-1 flex min-h-0">
            
            {/* Sidebar (Tracks) */}
            <div className="w-48 flex-shrink-0 border-r border-gray-100 bg-gray-50/30 flex flex-col pt-10"> {/* Top padding aligns with grid header */}
                {content.tracks?.map(track => (
                    <div key={track.id} className="h-20 px-3 flex items-center gap-2 group border-b border-gray-100/50 hover:bg-white transition-colors">
                        <div className="cursor-grab text-gray-300 hover:text-gray-500"><GripVertical size={12}/></div>
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: track.color }} />
                        <input 
                            value={track.name}
                            onChange={(e) => updateTrackName(track.id, e.target.value)}
                            className="flex-1 bg-transparent text-[13px] font-medium text-gray-700 border-none focus:ring-0 p-0"
                        />
                        <button 
                            onClick={() => removeTrack(track.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-opacity"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                <button 
                    onClick={addTrack}
                    className="m-3 py-2 border border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:text-[#3A5C34] hover:border-[#3A5C34] hover:bg-[#3A5C34]/5 transition-all"
                >
                    <Plus size={12} /> Add Track
                </button>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden relative no-scrollbar">
                
                {/* Header Row */}
                <div className="h-10 flex border-b border-gray-100 sticky top-0 bg-white z-10 min-w-max">
                    {gridColumns.map((col, i) => (
                        <div 
                            key={i} 
                            className={`flex-1 min-w-[40px] flex flex-col items-center justify-center border-r border-gray-50 ${content.viewMode === 'quarter' ? 'min-w-[120px]' : ''}`}
                        >
                            <span className="text-[11px] font-semibold text-gray-600">{col.label}</span>
                        </div>
                    ))}
                </div>

                {/* Rows Background */}
                <div className="min-w-max">
                    {content.tracks?.map(track => (
                        <div key={track.id} className="h-20 flex border-b border-gray-100/50 relative">
                            {/* Vertical Grid Lines */}
                            {gridColumns.map((_, i) => (
                                <div key={i} className={`flex-1 min-w-[40px] border-r border-gray-50 ${content.viewMode === 'quarter' ? 'min-w-[120px]' : ''}`} />
                            ))}
                            
                            {/* Drag Hint (Overlay) */}
                            <div className="absolute inset-0 hover:bg-[#3A5C34]/5 transition-colors pointer-events-none" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </BaseCard>
  );
};
