import React, { useState, useRef, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, AdsTestCardContent, AdRound, AdVariation } from '../../types';
import { 
  Beaker, Plus, Upload, Trophy, X, Download, MoreHorizontal, 
  Play, Eye, MousePointer2 
} from 'lucide-react';
import { soundService } from '../../services/soundService';
import { persistMedia, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { VideoThumb } from '../media/VideoThumb';

interface AdsTestCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const AdsTestCard: React.FC<AdsTestCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as AdsTestCardContent;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // Initialize Default Content
  useEffect(() => {
    if (!content.rounds) {
      onUpdateContent(card.id, {
        title: "Creative Testing",
        rounds: []
      });
    }
  }, []);

  const handleAddRound = () => {
    const newRound: AdRound = {
      id: `round-${Date.now()}`,
      name: `Round ${content.rounds.length + 1}: Concept`,
      variations: []
    };
    onUpdateContent(card.id, { ...content, rounds: [...content.rounds, newRound] });
    soundService.play('drop');
  };

  const handleDeleteRound = (roundId: string) => {
    onUpdateContent(card.id, { ...content, rounds: content.rounds.filter(r => r.id !== roundId) });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || !activeRoundId) return;

    const allowed = Array.from(files).filter(f => {
      if (!isWithinMediaLimit(f)) { alert(mediaLimitMessage()); return false; }
      return true;
    });

    const newVariations: AdVariation[] = await Promise.all(allowed.map(async file => ({
      id: `var-${Date.now()}-${Math.random()}`,
      type: file.type.startsWith('video') ? 'video' : 'image',
      url: await persistMedia(file),
      status: 'active' as const,
      ctr: 0
    })));

    const updatedRounds = content.rounds.map(r => 
      r.id === activeRoundId 
      ? { ...r, variations: [...r.variations, ...newVariations] }
      : r
    );

    onUpdateContent(card.id, { ...content, rounds: updatedRounds });
    setActiveRoundId(null);
    soundService.play('drop');
  };

  const toggleStatus = (roundId: string, varId: string) => {
    const updatedRounds = content.rounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        variations: r.variations.map(v => {
          if (v.id !== varId) return v;
          const nextStatus = v.status === 'active' ? 'winner' : (v.status === 'winner' ? 'loser' : 'active');
          if (nextStatus === 'winner') soundService.play('success');
          return { ...v, status: nextStatus };
        })
      };
    });
    onUpdateContent(card.id, { ...content, rounds: updatedRounds });
  };

  const deleteVariation = (roundId: string, varId: string) => {
    const updatedRounds = content.rounds.map(r => {
        if (r.id !== roundId) return r;
        return { ...r, variations: r.variations.filter(v => v.id !== varId) };
    });
    onUpdateContent(card.id, { ...content, rounds: updatedRounds });
  };

  const triggerUpload = (roundId: string) => {
    setActiveRoundId(roundId);
    fileInputRef.current?.click();
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "The Lab"} 
      icon={<Beaker size={16} className="text-[#3A5C34]"/>}
    >
      <div className="flex flex-col h-full bg-[#F9FAFB] p-4 gap-4 overflow-y-auto no-scrollbar">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*,video/*"
            onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {content.rounds?.map((round, rIndex) => (
            <div key={round.id} className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${rIndex * 100}ms` }}>
                {/* Round Header */}
                <div className="flex items-center justify-between px-1">
                    <input 
                        value={round.name}
                        onChange={(e) => {
                            const newRounds = [...content.rounds];
                            newRounds[rIndex].name = e.target.value;
                            onUpdateContent(card.id, { ...content, rounds: newRounds });
                        }}
                        className="bg-transparent font-bold text-[14px] text-gray-800 border-none focus:ring-0 p-0"
                    />
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => triggerUpload(round.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:border-[#3A5C34] hover:text-[#3A5C34] transition-all shadow-sm"
                        >
                            <Upload size={12} /> Upload
                        </button>
                        <button
                            onClick={() => handleDeleteRound(round.id)}
                            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Variations Horizontal Scroll */}
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar min-h-[160px]">
                    {round.variations.map(variation => (
                        <div 
                            key={variation.id} 
                            className={`
                                relative group flex-shrink-0 w-32 aspect-[3/4] bg-white rounded-xl shadow-sm overflow-hidden border-2 transition-all duration-300
                                ${variation.status === 'winner' ? 'border-[#FFD753] ring-4 ring-[#FFD753]/20 scale-105 z-10' : (variation.status === 'loser' ? 'border-transparent opacity-60 grayscale' : 'border-transparent hover:border-gray-200')}
                            `}
                        >
                            {/* Media */}
                            {variation.type === 'image' ? (
                                <img src={variation.url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-black relative">
                                    <VideoThumb url={variation.url} className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Play size={16} className="text-white fill-white" />
                                    </div>
                                </div>
                            )}

                            {/* Status Badge (Winner) */}
                            {variation.status === 'winner' && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-[#FFD753] rounded-full flex items-center justify-center text-[#5F2427] shadow-md z-20 animate-in zoom-in spin-in-12">
                                    <Trophy size={12} fill="currentColor" />
                                </div>
                            )}

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
                                <div className="flex gap-1.5">
                                    <button 
                                        onClick={() => toggleStatus(round.id, variation.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md ${variation.status === 'winner' ? 'bg-white text-gray-900' : 'bg-[#3A5C34] text-white'}`}
                                    >
                                        {variation.status === 'winner' ? 'Unmark' : 'Winner'}
                                    </button>
                                    <button 
                                        onClick={() => deleteVariation(round.id, variation.id)}
                                        className="w-7 h-7 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-red-500/80 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-white/80 px-1 font-mono">
                                    <span className="flex items-center gap-1"><MousePointer2 size={8}/> {variation.ctr}%</span>
                                    {variation.status === 'loser' && <span className="text-red-300 font-bold">DROP</span>}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Empty State / Drop Zone */}
                    {round.variations.length === 0 && (
                        <div 
                            onClick={() => triggerUpload(round.id)}
                            className="w-32 aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-300 hover:border-[#3A5C34] hover:bg-[#3A5C34]/5 hover:text-[#3A5C34] transition-all cursor-pointer"
                        >
                            <Plus size={24} />
                            <span className="text-[10px] font-medium">Add Assets</span>
                        </div>
                    )}
                </div>
            </div>
        ))}

        <button 
            onClick={handleAddRound}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-medium text-[13px] hover:border-[#3A5C34] hover:text-[#3A5C34] hover:bg-[#3A5C34]/5 transition-all flex items-center justify-center gap-2"
        >
            <Plus size={16} /> Add Testing Round
        </button>

      </div>
    </BaseCard>
  );
};
