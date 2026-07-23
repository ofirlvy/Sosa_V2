import React, { useEffect, useState } from 'react';
import { BaseCard } from '../BaseCard';
import { CardData, AvScriptContent, ScriptLine } from '../../../types';
import { FileAudio, Plus, Trash2, Clock, Mic, Eye, GripVertical } from 'lucide-react';

interface AvScriptCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const AvScriptCard: React.FC<AvScriptCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as AvScriptContent;

  useEffect(() => {
    if (!content.lines) {
      onUpdateContent(card.id, {
        title: '',
        lines: [],
        estimatedDuration: 0
      });
    }
  }, []);

  // Calculate Duration (Approx 2.5 words per second is standard speaking rate)
  const calculateDuration = (lines: ScriptLine[]) => {
      let totalWords = 0;
      lines.forEach(l => {
          totalWords += l.audio.trim().split(/\s+/).length;
      });
      // Pause logic: Empty audio lines count as visual beats (2s)
      const pauses = lines.filter(l => !l.audio.trim() && l.visual.trim()).length * 2;
      return Math.ceil((totalWords / 2.5) + pauses);
  };

  const addLine = () => {
    const newLine: ScriptLine = { id: `line-${Date.now()}`, visual: '', audio: '' };
    const newLines = [...(content.lines || []), newLine];
    onUpdateContent(card.id, { ...content, lines: newLines, estimatedDuration: calculateDuration(newLines) });
  };

  const updateLine = (id: string, field: 'visual' | 'audio', value: string) => {
    const newLines = content.lines.map(l => l.id === id ? { ...l, [field]: value } : l);
    onUpdateContent(card.id, { ...content, lines: newLines, estimatedDuration: calculateDuration(newLines) });
  };

  const deleteLine = (id: string) => {
    const newLines = content.lines.filter(l => l.id !== id);
    onUpdateContent(card.id, { ...content, lines: newLines, estimatedDuration: calculateDuration(newLines) });
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "A/V Script"} 
      icon={<FileAudio size={16} className="text-gray-700" />}
    >
      <div className="flex flex-col h-full bg-white">
        
        {/* Header Grid */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider select-none">
            <div className="flex-1 p-3 border-r border-gray-200 flex items-center gap-2">
                <Eye size={12} /> Visual (Video)
            </div>
            <div className="flex-1 p-3 flex items-center gap-2">
                <Mic size={12} /> Audio (Voiceover)
            </div>
            <div className="w-8"></div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
            {content.lines?.map((line, i) => (
                <div key={line.id} className="flex border-b border-gray-100 group min-h-[80px]">
                    {/* Visual Column (Gray tint) */}
                    <div className="flex-1 border-r border-gray-100 bg-gray-50/30 p-2">
                        <textarea 
                            className="w-full h-full bg-transparent resize-none border-none focus:ring-0 p-1 text-[13px] leading-relaxed text-gray-700 placeholder-gray-400"
                            placeholder="Describe scene..."
                            value={line.visual}
                            onChange={(e) => updateLine(line.id, 'visual', e.target.value)}
                        />
                    </div>
                    
                    {/* Audio Column (White) */}
                    <div className="flex-1 bg-white p-2">
                        <textarea 
                            className="w-full h-full bg-transparent resize-none border-none focus:ring-0 p-1 text-[13px] leading-relaxed text-gray-900 font-medium placeholder-gray-300"
                            placeholder="Dialogue or SFX..."
                            value={line.audio}
                            onChange={(e) => updateLine(line.id, 'audio', e.target.value)}
                        />
                    </div>

                    {/* Controls */}
                    <div className="w-8 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-l border-gray-50">
                        <button 
                            onClick={() => deleteLine(line.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            ))}
            
            <button 
                onClick={addLine}
                className="w-full py-3 flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-b border-dashed border-gray-200"
            >
                <Plus size={14} /> Add Scene
            </button>
        </div>

        {/* Footer Stats */}
        <div className="p-3 bg-white border-t border-gray-100 flex justify-between items-center text-[12px] font-medium text-gray-600">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                <Clock size={12} />
                <span>~{content.estimatedDuration || 0} seconds</span>
            </div>
            {content.estimatedDuration > 60 && (
                <span className="text-red-500 text-[11px] font-bold px-2">⚠️ Over 60s limit</span>
            )}
        </div>
      </div>
    </BaseCard>
  );
};