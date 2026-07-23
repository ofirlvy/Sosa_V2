import React, { useRef, useState, useEffect } from 'react';
import { BaseCard } from '../BaseCard';
import { CardData, FilmstripContent, FilmstripFrame } from '../../../types';
import { Film, Plus, Play, Image as ImageIcon, X, ArrowRight } from 'lucide-react';
import { soundService } from '../../../services/soundService';
import { persistMedia, isWithinMediaLimit, mediaLimitMessage } from '../../../services/fileService';

interface FilmstripCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const FilmstripCard: React.FC<FilmstripCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as FilmstripContent;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Initialize
  useEffect(() => {
    if (!content.frames) {
      onUpdateContent(card.id, {
        title: 'Visual Storyboard',
        frames: []
      });
    }
  }, []);

  // Slideshow Logic
  useEffect(() => {
    let interval: any;
    if (isPlaying && content.frames?.length > 0) {
        interval = setInterval(() => {
            setPreviewIndex(prev => {
                if (prev >= content.frames.length - 1) {
                    setIsPlaying(false);
                    return 0;
                }
                return prev + 1;
            });
        }, 1500); // 1.5s per frame
    }
    return () => clearInterval(interval);
  }, [isPlaying, content.frames]);

  const handleAddFrame = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter(f => {
      if (!isWithinMediaLimit(f)) { alert(mediaLimitMessage()); return false; }
      return true;
    });
    const newFrames: FilmstripFrame[] = await Promise.all(allowed.map(async file => ({
      id: `frame-${Date.now()}-${Math.random()}`,
      type: 'image' as const,
      url: await persistMedia(file),
      note: '',
      transition: 'cut' as const
    })));

    if (newFrames.length === 0) return;
    onUpdateContent(card.id, { ...content, frames: [...(content.frames || []), ...newFrames] });
    soundService.play('drop');
    // Scroll to end
    setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }, 100);
  };

  const updateFrameNote = (id: string, note: string) => {
      const frames = content.frames.map(f => f.id === id ? { ...f, note } : f);
      onUpdateContent(card.id, { ...content, frames });
  };

  const deleteFrame = (id: string) => {
      onUpdateContent(card.id, { ...content, frames: content.frames.filter(f => f.id !== id) });
  };

  return (
    <BaseCard 
      {...props} 
      title={content.title || "Storyboard"} 
      icon={<Film size={16} className="text-[#5856D6]" />}
    >
      <div className="flex flex-col h-full bg-[#1C1C1E] text-white relative overflow-hidden rounded-b-[24px]">
        <input 
            type="file" 
            ref={fileInputRef} 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Playback Overlay (Animatic Mode) */}
        {isPlaying && content.frames.length > 0 && (
            <div className="absolute inset-0 z-20 bg-black flex items-center justify-center animate-in fade-in duration-300">
                <img 
                    src={content.frames[previewIndex].url} 
                    className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-500"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur rounded-full text-[12px] font-mono">
                    Frame {previewIndex + 1} / {content.frames.length}
                </div>
                <button 
                    onClick={() => setIsPlaying(false)}
                    className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        {/* Toolbar */}
        <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {content.frames?.length || 0} Frames • ~{((content.frames?.length || 0) * 1.5).toFixed(0)}s
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => { setPreviewIndex(0); setIsPlaying(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#5856D6] hover:bg-[#4644aa] rounded-full text-[12px] font-bold transition-colors"
                    disabled={!content.frames?.length}
                >
                    <Play size={12} fill="currentColor" /> Play Animatic
                </button>
            </div>
        </div>

        {/* Filmstrip Reel */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar flex items-center p-4 bg-[#111]" ref={scrollRef}>
            
            {/* Start Leader */}
            <div className="w-8 h-full border-y-4 border-dashed border-gray-800 shrink-0 bg-black/50" />

            {content.frames?.map((frame, index) => (
                <div key={frame.id} className="flex items-center">
                    {/* Frame */}
                    <div className="relative group w-48 aspect-video bg-gray-900 border-y-[6px] border-black flex-shrink-0 flex flex-col">
                        {/* Sprocket Holes */}
                        <div className="absolute top-[-5px] left-0 right-0 h-[4px] flex justify-between px-1">
                            {[1,2,3,4].map(i => <div key={i} className="w-[3px] h-[3px] bg-gray-600 rounded-full"/>)}
                        </div>
                        
                        {/* Image Content */}
                        <div className="relative flex-1 overflow-hidden group-hover:ring-1 ring-white/50 transition-all">
                            <img src={frame.url} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => deleteFrame(frame.id)}
                                className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                            >
                                <X size={10} />
                            </button>
                        </div>

                        {/* Note Input */}
                        <input 
                            value={frame.note}
                            onChange={(e) => updateFrameNote(frame.id, e.target.value)}
                            placeholder="Action note..."
                            className="h-7 bg-[#222] text-[10px] text-gray-300 px-2 border-none focus:ring-0 w-full font-mono text-center placeholder-gray-600"
                        />

                        <div className="absolute bottom-[-5px] left-0 right-0 h-[4px] flex justify-between px-1">
                            {[1,2,3,4].map(i => <div key={i} className="w-[3px] h-[3px] bg-gray-600 rounded-full"/>)}
                        </div>
                        
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-gray-500">
                            {index + 1}
                        </div>
                    </div>

                    {/* Connector */}
                    <div className="w-6 h-0.5 bg-gray-800 mx-1 relative">
                        {index < content.frames.length - 1 && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#111] border border-gray-700 rounded-full flex items-center justify-center">
                                <ArrowRight size={8} className="text-gray-500" />
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add Button */}
            <button 
                onClick={handleAddFrame}
                className="w-24 aspect-video border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-white hover:border-gray-500 transition-all shrink-0 ml-2"
            >
                <Plus size={20} />
                <span className="text-[10px] font-medium">Add Frame</span>
            </button>

            {/* End Leader */}
            <div className="w-16 h-full border-y-4 border-dashed border-gray-800 shrink-0 bg-black/50 ml-4" />
        </div>
      </div>
    </BaseCard>
  );
};