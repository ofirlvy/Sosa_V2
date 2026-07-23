import React, { useEffect } from 'react';
import { BaseCard } from '../BaseCard';
import { CardData, CallSheetContent, CrewMember } from '../../../types';
import { ClipboardList, MapPin, Calendar, Sun, CloudRain, Clock, User, CheckCircle2, CircleDashed } from 'lucide-react';

interface CallSheetCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const CallSheetCard: React.FC<CallSheetCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as CallSheetContent;

  useEffect(() => {
    if (!content.status) {
      onUpdateContent(card.id, {
        title: '',
        shootDate: new Date().toISOString().split('T')[0],
        callTime: '',
        location: '',
        status: 'pre-pro',
        crew: []
      });
    }
  }, []);

  const toggleStatus = () => {
      const nextStatus = content.status === 'pre-pro' ? 'on-set' : (content.status === 'on-set' ? 'wrapped' : 'pre-pro');
      onUpdateContent(card.id, { ...content, status: nextStatus });
  };

  const getStatusColor = () => {
      switch(content.status) {
          case 'pre-pro': return 'bg-blue-100 text-blue-700';
          case 'on-set': return 'bg-red-100 text-red-700 animate-pulse';
          case 'wrapped': return 'bg-green-100 text-green-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const updateField = (key: keyof CallSheetContent, value: string) => {
      onUpdateContent(card.id, { ...content, [key]: value });
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Call Sheet"} 
      icon={<ClipboardList size={16} className="text-[#FF9500]" />}
    >
      <div className="flex flex-col h-full bg-white p-5 space-y-6">
        
        {/* Top Status Bar */}
        <div className="flex items-center justify-between">
            <div>
                <input 
                    className="text-[20px] font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full"
                    value={content.title}
                    onChange={(e) => updateField('title', e.target.value)}
                />
            </div>
            <button 
                onClick={toggleStatus}
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusColor()}`}
            >
                {content.status?.replace('-', ' ')}
            </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-[12px] font-medium text-gray-400">
                    <Calendar size={12} /> Date
                </div>
                <input 
                    type="date"
                    className="w-full bg-gray-50 border-none rounded-lg text-[13px] font-semibold text-gray-800 py-1.5 px-2"
                    value={content.shootDate}
                    onChange={(e) => updateField('shootDate', e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-[12px] font-medium text-gray-400">
                    <Clock size={12} /> Call Time
                </div>
                <input 
                    type="time"
                    className="w-full bg-gray-50 border-none rounded-lg text-[13px] font-semibold text-gray-800 py-1.5 px-2"
                    value={content.callTime}
                    onChange={(e) => updateField('callTime', e.target.value)}
                />
            </div>
            <div className="col-span-2 space-y-1">
                <div className="flex items-center gap-2 text-[12px] font-medium text-gray-400">
                    <MapPin size={12} /> Location
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2">
                    <input 
                        className="w-full bg-transparent border-none text-[13px] font-semibold text-gray-800 py-1.5 focus:ring-0 p-0"
                        value={content.location}
                        onChange={(e) => updateField('location', e.target.value)}
                    />
                    <Sun size={16} className="text-orange-400 shrink-0" /> {/* Mock Weather */}
                </div>
            </div>
        </div>

        {/* Crew List */}
        <div>
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Crew & Talent</span>
                <span className="text-[11px] text-gray-400">{content.crew?.length} Pax</span>
            </div>
            
            <div className="space-y-3">
                {content.crew?.map(member => (
                    <div key={member.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${member.role === 'Talent' ? 'bg-[#FF9500]' : 'bg-gray-400'}`}>
                            {member.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-gray-900 truncate">{member.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">{member.role}</div>
                        </div>
                        <div>
                            {member.status === 'confirmed' ? (
                                <CheckCircle2 size={16} className="text-[#3A5C34]" />
                            ) : (
                                <CircleDashed size={16} className="text-gray-300" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </BaseCard>
  );
};