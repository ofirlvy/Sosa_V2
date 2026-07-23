import React, { useEffect } from 'react';
import { BaseCard } from '../BaseCard';
import { CardData, CastingBoardContent } from '../../../types';
import { Users, Instagram, Youtube, UserPlus, Check, X, User } from 'lucide-react';

interface CastingBoardCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const CastingBoardCard: React.FC<CastingBoardCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as CastingBoardContent;

  useEffect(() => {
    if (!content.candidates) {
      onUpdateContent(card.id, {
        title: 'Influencer Casting',
        candidates: []
      });
    }
  }, []);

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'scouted': return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Scouted' };
          case 'contacted': return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Contacted' };
          case 'booked': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Booked' };
          case 'passed': return { bg: 'bg-red-50', text: 'text-red-500', label: 'Passed' };
          default: return { bg: 'bg-gray-50', text: 'text-gray-500', label: status };
      }
  };

  const updateStatus = (id: string) => {
      const nextStatus: Record<string, string> = { 'scouted': 'contacted', 'contacted': 'booked', 'booked': 'passed', 'passed': 'scouted' };
      const newCandidates = content.candidates.map(c => c.id === id ? { ...c, status: nextStatus[c.status] as any } : c);
      onUpdateContent(card.id, { ...content, candidates: newCandidates });
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Casting"} 
      icon={<Users size={16} className="text-[#FCCAE2]" style={{ color: '#D63384' }} />}
    >
      <div className="flex flex-col h-full bg-[#F9F8F6] p-4 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-2 gap-3">
            {content.candidates?.map(candidate => {
                const badge = getStatusBadge(candidate.status);
                return (
                    <div 
                        key={candidate.id} 
                        className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 group hover:shadow-md transition-all cursor-pointer"
                        onClick={() => updateStatus(candidate.id)}
                    >
                        {/* Avatar / Placeholder */}
                        <div className="w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 relative overflow-hidden">
                            {candidate.imageUrl ? (
                                <img src={candidate.imageUrl} className="w-full h-full object-cover" />
                            ) : (
                                <User size={32} />
                            )}
                            {/* Platform Icon Overlay */}
                            <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm">
                                {candidate.platform === 'ig' ? <Instagram size={10} /> : <Youtube size={10} />}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[13px] font-bold text-gray-900 leading-tight">{candidate.name}</h4>
                            <p className="text-[11px] text-gray-500">{candidate.handle}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-0.5">{candidate.followers} followers</p>
                        </div>

                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold text-center uppercase tracking-wide ${badge.bg} ${badge.text}`}>
                            {badge.label}
                        </div>
                    </div>
                );
            })}

            {/* Add Button */}
            <button className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#D63384] hover:text-[#D63384] hover:bg-[#D63384]/5 transition-all">
                <UserPlus size={24} />
                <span className="text-[11px] font-medium">Add Talent</span>
            </button>
        </div>
      </div>
    </BaseCard>
  );
};