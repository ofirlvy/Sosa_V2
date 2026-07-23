import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { BaseCard } from './BaseCard';
import { CardData, TaskList, TaskItem, MediaItem, Comment, PostCardContent } from '../../types';
import { 
  FileImage, Paperclip, Plus, Trash2,
  Link as LinkIcon, Image as ImageIcon, X, Send, UserPlus, Pencil, Video, Maximize2, Download,
  Check, ChevronLeft, ChevronRight, Calendar, LayoutGrid, ChevronDown
} from 'lucide-react';
import { soundService } from '../../services/soundService';
import { PublishModal } from '../modals/PublishModal';
import { InstagramPreviewModal } from '../modals/InstagramPreviewModal';
import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { toISODate } from '../../services/dateUtils';
import { StatusPill, FullscreenFooterRow, DateChip, StatusChip, PreviewButton, AssigneeStack, useAutosizeRef } from './cardKit';
import { useMockupProfile } from '../../contexts/BrandIdentity';
import { VideoThumb } from '../media/VideoThumb';

interface PostCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  isLinked?: boolean;
  linkedDate?: Date;
  isMultiSelect?: boolean;
  /** Two-stage gesture: expand only on second click / double-click. */
  isExpanded?: boolean;
  isFullscreen?: boolean;
  /** Controlled-fullscreen callback (e.g. editing from the Feed page). */
  onFullscreenChange?: (id: string, next: boolean) => void;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
}

// --- Helper Components ---

interface MediaPreviewOverlayProps {
  initialItem: MediaItem;
  items: MediaItem[];
  onClose: () => void;
}

const MediaPreviewOverlay: React.FC<MediaPreviewOverlayProps> = ({ initialItem, items, onClose }) => {
  const [currentItem, setCurrentItem] = useState(initialItem);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, items, onClose]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (scrollRef.current) {
        const index = items.findIndex(i => i.id === currentItem.id);
        if (index !== -1) {
            const thumbnail = scrollRef.current.children[index] as HTMLElement;
            if (thumbnail) {
                thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }
  }, [currentItem]);

  const navigate = (direction: number) => {
    const currentIndex = items.findIndex(i => i.id === currentItem.id);
    if (currentIndex === -1) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < items.length) {
      setCurrentItem(items[newIndex]);
    }
  };

  if (!currentItem || currentItem.type === 'empty') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
        {/* Navigation Arrows */}
        <button 
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-black/5 text-gray-500 hover:text-black transition-all disabled:opacity-30 z-20"
            disabled={items.indexOf(currentItem) === 0}
        >
            <ChevronLeft size={32} />
        </button>
        <button 
            onClick={(e) => { e.stopPropagation(); navigate(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-black/5 text-gray-500 hover:text-black transition-all disabled:opacity-30 z-20"
            disabled={items.indexOf(currentItem) === items.length - 1}
        >
            <ChevronRight size={32} />
        </button>

      <div 
        className="relative w-full h-full flex flex-col items-center justify-center pb-20"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-white max-h-[70vh] max-w-[85vw] flex items-center justify-center">
          {currentItem.type === 'image' && (
            <img src={currentItem.url} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
          )}
          {currentItem.type === 'video' && (
            <video src={currentItem.url} poster={currentItem.thumbnail} controls autoPlay className="max-w-full max-h-[70vh] object-contain" />
          )}
          {currentItem.type === 'link' && (
            <div className="w-[600px] h-[400px] flex flex-col items-center justify-center bg-gray-50 text-gray-500">
              <LinkIcon size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">{currentItem.url}</p>
            </div>
          )}
        </div>

        {/* Bottom Bar: Thumbnails + Actions */}
        <div className="absolute bottom-8 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 max-w-[90vw]">
            
            {/* 1. Thumbnail Strip */}
            <div 
                className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 shadow-lg overflow-x-auto no-scrollbar flex gap-2 max-w-[60vw]"
                ref={scrollRef}
                onClick={(e) => e.stopPropagation()}
            >
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentItem(item)}
                        className={`
                            relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 transition-all
                            ${item.id === currentItem.id ? 'ring-2 ring-black ring-offset-1 opacity-100 scale-100' : 'opacity-50 hover:opacity-100 hover:scale-105'}
                        `}
                    >
                        {item.type === 'image' && <img src={item.url} className="w-full h-full object-cover" />}
                        {item.type === 'video' && (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                                <Video size={14} className="text-white" />
                            </div>
                        )}
                        {item.type === 'link' && (
                            <div className="w-full h-full bg-blue-50 flex items-center justify-center text-[#3A5C34]">
                                <LinkIcon size={14} />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* 2. Download Pill */}
            {currentItem.url && (
             <a 
               href={currentItem.url} 
               download 
               onClick={(e) => e.stopPropagation()}
               className="h-12 px-6 rounded-full bg-black text-white shadow-lg border border-gray-800 font-medium hover:scale-105 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
             >
               <Download size={16} />
               <span className="text-[14px]">Download</span>
             </a>
           )}

            {/* 3. Close Circle */}
           <button 
             onClick={onClose}
             className="w-12 h-12 rounded-full bg-white text-gray-900 shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all flex-shrink-0"
           >
             <X size={20} />
           </button>

        </div>
      </div>
    </div>,
    document.body
  );
};

interface AddMediaButtonProps {
  onFilesSelected: (files: File[]) => void;
  onPinDropped: (url: string, link: string) => void;
}

const AddMediaButton: React.FC<AddMediaButtonProps> = ({ onFilesSelected, onPinDropped }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Check for Pinterest Pin drop first
    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.type === 'PINTEREST_PIN') {
          onPinDropped(data.url, data.link);
          return;
        }
      } catch (err) { /* ignore */ }
    }

    // Fallback to file drop
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
      onDrop={handleDrop}
      className={`
        aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center transition-all duration-200 no-drag relative group cursor-pointer
        ${isDragOver ? 'border-[#3A5C34] bg-[#FCCAE2]/20' : 'bg-white border-gray-300 hover:border-[#3A5C34] hover:bg-[#FCCAE2]/10'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/*,video/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
      />
      
      {/* Circular Button Style */}
      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-[#3A5C34] group-hover:scale-110 group-active:scale-95 transition-all">
         <Plus size={14} />
      </div>

      {isDragOver && (
          <div className="absolute bottom-2 text-[#3A5C34] font-bold text-[9px] animate-pulse pointer-events-none">DROP</div>
      )}
    </div>
  );
};

interface MediaCubeProps {
  item: MediaItem;
  index: number;
  listType: 'references' | 'finalAssets';
  onRemove: () => void;
  onUpdate: (i: MediaItem) => void;
  onFilesSelected: (files: File[]) => void;
  onPreview: () => void;
  onDropItem: (dragIndex: number, hoverIndex: number, listType: 'references' | 'finalAssets') => void;
}

const MediaCube: React.FC<MediaCubeProps> = ({ 
  item, 
  index, 
  listType,
  onRemove, 
  onUpdate, 
  onFilesSelected, 
  onPreview,
  onDropItem
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({ index, listType }));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a drag image
    const dragGhost = document.createElement('div');
    dragGhost.style.width = '40px';
    dragGhost.style.height = '40px';
    dragGhost.style.backgroundColor = '#3A5C34';
    dragGhost.style.borderRadius = '8px';
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 20, 20);
    setTimeout(() => document.body.removeChild(dragGhost), 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        
        // 1. Handle Pinterest Pin Drop (Replace Content)
        if (data.type === 'PINTEREST_PIN') {
            onUpdate({
                ...item,
                type: 'image',
                url: data.url,
                sourceLink: data.link
            });
            return;
        }

        // 2. Handle Reordering
        if (data.listType === listType) {
          onDropItem(data.index, index, listType);
        }
      } catch (err) {
        // ignore JSON parse error
      }
    } else if (e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div 
      className={`
        aspect-square relative group rounded-xl overflow-hidden transition-all duration-300
        bg-white shadow-sm ring-1 ring-black/5
        ${isDragOver ? 'scale-105 ring-2 ring-[#3A5C34] z-10' : ''}
        no-drag cursor-pointer
      `}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPreview();
      }}
    >
      {item.type === 'image' && <img src={item.url} alt="asset" className="w-full h-full object-cover select-none pointer-events-none" />}
      {item.type === 'video' && (
        <div className="w-full h-full bg-black flex items-center justify-center relative select-none pointer-events-none">
            <VideoThumb url={item.url} thumbnail={item.thumbnail} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
                <Video size={14} className="text-white fill-white" />
                </div>
            </div>
        </div>
      )}
      {item.type === 'link' && <div className="w-full h-full flex items-center justify-center bg-blue-50 text-[#3A5C34]"><LinkIcon size={20}/></div>}
      
      {/* Hover Actions */}
      <div className={`absolute inset-0 bg-black/0 transition-colors duration-200 ${isHovered ? 'bg-black/10' : ''}`}>
          {isHovered && (
            <div className="absolute top-1.5 right-1.5 flex gap-1 animate-in fade-in duration-200">
                <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="w-6 h-6 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-full text-red-500 hover:scale-110 transition-transform shadow-sm"
                >
                <Trash2 size={10} />
                </button>
            </div>
          )}
          {isHovered && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white drop-shadow-md">
                <Maximize2 size={14} />
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

interface TaskListBlockProps {
  list: TaskList;
  onUpdate: (l: TaskList) => void;
  onDelete: () => void;
}

const TaskListBlock: React.FC<TaskListBlockProps> = ({ list, onUpdate, onDelete }) => {
  const [newItemText, setNewItemText] = useState("");

  // Map legacy colors to Sosa Brand Palette
  // red -> Burgundy, green -> Forest, yellow -> Vibrant Yellow
  const theme = {
    // Blue (Utility / Calm)
    blue:   { 
        bg: 'bg-[#007AFF]/5', 
        border: 'border-[#007AFF]/10', 
        title: 'text-[#007AFF]', 
        text: 'text-[#1C1C1E]', 
        placeholder: 'placeholder-[#007AFF]/40', 
        checkbox: 'border-[#007AFF]/30 text-[#007AFF]', 
        checkboxActive: 'bg-[#007AFF] border-[#007AFF] text-white', 
 