
import React, { useRef, useEffect, useState } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, NewsletterCardContent } from '../../types';
import { Mail, Clock, Users, Ban, Upload, X, ChevronDown, UserPlus } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { persistMedia, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { AssigneeStack } from './cardKit';

interface NewsletterCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
}

export const NewsletterCard: React.FC<NewsletterCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as NewsletterCardContent;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Comments live in the board chat drawer; never keep a local copy (clobber risk).

  useEffect(() => {
    if (!content.title) {
      onUpdateContent(card.id, {
        title: 'Weekly Digest',
        subject: 'You won\'t believe this update...',
        previewText: 'Plus: 3 new features inside.',
        segment: 'All Subscribers',
        exclusion: 'Unengaged (90 days)',
        sendTime: new Date().toISOString().slice(0, 16),
        status: 'draft',
        comments: []
      });
    }
  }, []);

  const updateField = (key: keyof NewsletterCardContent, value: string) => {
    onUpdateContent(card.id, { ...content, [key]: value });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type.startsWith('image/')) {
        if (!isWithinMediaLimit(file)) { alert(mediaLimitMessage()); return; }
        const url = await persistMedia(file);
        updateField('designUrl', url);
        soundService.play('drop');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Newsletter"} 
      icon={<Mail size={16} className="text-[#5F2427]" />}
    >
      <div className="flex flex-col h-full bg-[#F9F8F6]">
        
        {(
            <>
                {/* 1. Header & Inbox Simulator */}
                <div className="p-4 bg-white border-b border-gray-200 space-y-4 shadow-sm z-10 shrink-0">
                    {/* Internal Title */}
                    <div>
                        <input 
                            className="w-full text-[18px] font-bold text-[#1C1C1E] border-none p-0 focus:ring-0 placeholder-gray-300 bg-transparent"
                            placeholder="Campaign Name"
                            value={content.title}
                            onChange={(e) => updateField('title', e.target.value)}
                        />
                        <div className="text-[11px] font-medium text-gray-400 mt-0.5 uppercase tracking-wide">Internal Name</div>
                    </div>

                    {/* Inbox Row Simulation */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col gap-1.5 group hover:border-[#3A5C34]/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded-full bg-[#5F2427] text-white flex items-center justify-center text-[8px] font-bold">{(content.senderName || 'Y')[0].toUpperCase()}</div>
                            <input
                                className="text-[11px] font-bold text-gray-700 bg-transparent border-none p-0 focus:ring-0 w-24 placeholder-gray-400"
                                placeholder="Your Brand"
                                value={content.senderName || ''}
                                onChange={(e) => updateField('senderName', e.target.value)}
                            />
                            <span className="text-[10px] text-gray-400">to me</span>
                        </div>
                        <div>
                            <input 
                                className="w-full text-[13px] font-bold text-[#1C1C1E] bg-transparent border-none p-0 focus:ring-0 leading-tight placeholder-gray-400"
                                placeholder="Subject Line"
                                value={content.subject}
                                onChange={(e) => updateField('subject', e.target.value)}
                            />
                        </div>
                        <div>
                            <input 
                                className="w-full text-[13px] font-normal text-gray-500 bg-transparent border-none p-0 focus:ring-0 leading-tight placeholder-gray-300"
                                placeholder="Preview Text"
                                value={content.previewText}
                                onChange={(e) => updateField('previewText', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Design Canvas (Scrollable Body) */}
                <div 
                    className={`flex-1 overflow-y-auto relative min-h-[200px] transition-colors ${isDragOver ? 'bg-[#3A5C34]/10' : 'bg-[#E5E5EA]/30'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                >
                    {content.designUrl ? (
                        <div className="relative w-full group">
                            <img 
                                src={content.designUrl} 
                                className="w-full h-auto block" 
                                alt="Newsletter Design" 
                            />
                            {/* Hover Actions */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-white/90 backdrop-blur rounded-full text-gray-700 shadow-sm hover:scale-110 transition-transform"
                                >
                                    <Upload size={14} />
                                </button>
                                <button 
                                    onClick={() => updateField('designUrl', '')}
                                    className="p-2 bg-white/90 backdrop-blur rounded-full text-red-500 shadow-sm hover:scale-110 transition-transform"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-4 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#3A5C34] hover:bg-white transition-all text-gray-400 hover:text-[#3A5C34]"
                        >
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                                <Upload size={20} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold">Drop Design Here</p>
                                <p className="text-[11px] opacity-70">or click to upload</p>
                            </div>
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e.target.files)} 
                    />
                </div>

                {/* 3. Flight Control (Settings Footer) */}
                <div className="bg-white border-t border-gray-200 p-4 shrink-0">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Segment */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                <Users size={12} /> Segment
                            </div>
                            <div className="relative">
                                <input 
                                    className="w-full bg-gray-50 border-none rounded-lg text-[13px] font-semibold text-gray-800 py-2 px-3 focus:ring-2 focus:ring-[#3A5C34]/20"
                                    value={content.segment}
                                    onChange={(e) => updateField('segment', e.target.value)}
                                />
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        
                        {/* Exclusion */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                <Ban size={12} /> Exclude
                            </div>
                            <div className="relative">
                                <input 
                                    className="w-full bg-red-50 border-none rounded-lg text-[13px] font-semibold text-red-800 py-2 px-3 focus:ring-2 focus:ring-red-200 placeholder-red-300"
                                    value={content.exclusion}
                                    onChange={(e) => updateField('exclusion', e.target.value)}
                                />
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 pointer-events-none" />
                            </div>
                        </div>

                        {/* Send Time */}
                        <div className="col-span-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                <Clock size={12} /> Send Time
                            </div>
                            <input 
                                type="datetime-local"
                                className="w-full bg-gray-50 border-none rounded-lg text-[13px] font-semibold text-gray-800 py-2 px-3 focus:ring-2 focus:ring-[#3A5C34]/20"
                                value={content.sendTime}
                                onChange={(e) => updateField('sendTime', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* Action Bar (Footer) — real assignees from the brand roster */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between z-20 shrink-0">
            <AssigneeStack
                assigneeIds={content.assignees || []}
                onChange={(ids) => onUpdateContent(card.id, { ...content, assignees: ids })}
            />
        </div>

      </div>
    </BaseCard>
  );
};
