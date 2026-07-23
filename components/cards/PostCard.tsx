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
        icon: 'text-[#007AFF]/50 hover:text-[#007AFF]' 
    },
    // Green (Forest)
    green:  { 
        bg: 'bg-[#3A5C34]/5', 
        border: 'border-[#3A5C34]/10', 
        title: 'text-[#3A5C34]', 
        text: 'text-[#1C1C1E]', 
        placeholder: 'placeholder-[#3A5C34]/40', 
        checkbox: 'border-[#3A5C34]/30 text-[#3A5C34]', 
        checkboxActive: 'bg-[#3A5C34] border-[#3A5C34] text-white', 
        icon: 'text-[#3A5C34]/50 hover:text-[#3A5C34]' 
    },
    // Yellow (Vibrant)
    yellow: { 
        bg: 'bg-[#FFD753]/10', 
        border: 'border-[#FFD753]/30', 
        title: 'text-[#926008]', // Darker for legibility
        text: 'text-[#1C1C1E]', 
        placeholder: 'placeholder-[#926008]/40', 
        checkbox: 'border-[#FFD753]/60 text-[#926008]', 
        checkboxActive: 'bg-[#FFD753] border-[#FFD753] text-[#5F2427]', 
        icon: 'text-[#FFD753] hover:text-[#926008]' 
    },
    // Red (Mapped to Sosa Burgundy)
    red:    { 
        bg: 'bg-[#5F2427]/5', 
        border: 'border-[#5F2427]/10', 
        title: 'text-[#5F2427]', 
        text: 'text-[#1C1C1E]', 
        placeholder: 'placeholder-[#5F2427]/40', 
        checkbox: 'border-[#5F2427]/30 text-[#5F2427]', 
        checkboxActive: 'bg-[#5F2427] border-[#5F2427] text-white', 
        icon: 'text-[#5F2427]/50 hover:text-[#5F2427]' 
    },
    // Gray (Warm Stone)
    gray:   { 
        bg: 'bg-gray-50', 
        border: 'border-gray-200', 
        title: 'text-gray-500', 
        text: 'text-[#1C1C1E]', 
        placeholder: 'placeholder-gray-400', 
        checkbox: 'border-gray-300 text-gray-500', 
        checkboxActive: 'bg-gray-500 border-gray-500 text-white', 
        icon: 'text-gray-300 hover:text-gray-500' 
    }
  }[list.color || 'gray'];

  const addItem = () => {
    if (!newItemText.trim()) return;
    const newItem: TaskItem = { id: Date.now().toString(), text: newItemText, done: false };
    onUpdate({ ...list, items: [...list.items, newItem] });
    setNewItemText("");
  };

  const toggleItem = (itemId: string) => {
    const updatedItems = list.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i);
    onUpdate({ ...list, items: updatedItems });
  };

  const deleteItem = (itemId: string) => {
    onUpdate({ ...list, items: list.items.filter(i => i.id !== itemId) });
  };

  return (
    <div className={`mb-3 p-4 rounded-xl border ${theme.bg} ${theme.border} no-drag cursor-auto transition-all`}>
      <div className="flex items-center justify-between mb-3">
        {/* Micro-Label Title Style */}
        <input 
          value={list.title}
          onChange={(e) => onUpdate({ ...list, title: e.target.value })}
          className={`bg-transparent text-[11px] font-bold uppercase tracking-wider border-none focus:ring-0 p-0 w-full ${theme.title}`}
          placeholder="List Name"
        />
        <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className={`w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors ${theme.icon}`}
        >
          <Trash2 size={12}/>
        </button>
      </div>
      
      <div className="space-y-2">
        {list.items.map(item => (
          <div key={item.id} className="flex items-start gap-3 group">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              className={`
                mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all flex-shrink-0
                ${item.done ? theme.checkboxActive : `bg-white ${theme.checkbox}`}
              `}
            >
              {item.done && <Check size={10} strokeWidth={4} />}
            </button>
            <div className="flex-1 min-w-0">
               <input 
                  value={item.text}
                  onChange={(e) => {
                    const updated = list.items.map(i => i.id === item.id ? { ...i, text: e.target.value } : i);
                    onUpdate({ ...list, items: updated });
                  }}
                  className={`
                    bg-transparent text-[14px] leading-relaxed w-full border-none focus:ring-0 p-0 
                    ${item.done ? 'text-gray-400 line-through decoration-gray-300' : theme.text}
                  `}
                />
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} 
                className={`opacity-0 group-hover:opacity-100 ${theme.icon} hover:text-red-500 transition-opacity`}
            >
               <X size={14} />
            </button>
          </div>
        ))}
        
        {/* Add Item Row */}
        <div className="flex items-center gap-3 mt-3 opacity-60 hover:opacity-100 transition-opacity">
           <Plus size={14} className={theme.icon}/>
           <input 
             value={newItemText}
             onChange={(e) => setNewItemText(e.target.value)}
             onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }}
             placeholder="Add Item"
             className={`bg-transparent text-[13px] font-medium border-none focus:ring-0 p-0 w-full ${theme.text} ${theme.placeholder}`}
           />
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

export const PostCard: React.FC<PostCardProps> = (props) => {
  const { card, isLinked, linkedDate, isSelected, isMultiSelect, onUpdateContent } = props;
  const content = card.content as PostCardContent;
  const [sku] = useState(content?.sku || `P-${Math.random().toString(36).substr(2, 4).toUpperCase()}`);
  const [title, setTitle] = useState(content?.title || "Untitled Post");
  
  // Date Handling
  // If linked, use linkedDate as source of truth. If standalone, use internal state.
  const [internalDate, setInternalDate] = useState(content?.date || "");
  const [postStatus, setPostStatus] = useState<string>(content?.status || "Idea");
  const displayDate = linkedDate ? toISODate(linkedDate) : internalDate;

  // Sync effect: When linkedDate changes, update internal storage so it persists if unlinked
  useEffect(() => {
      if (linkedDate) {
          const iso = toISODate(linkedDate);
          if (iso !== internalDate) {
              setInternalDate(iso);
          }
      }
  }, [linkedDate]);

  const [caption, setCaption] = useState(content?.caption || "");
  // One line when empty, growing line by line as you type. The callback ref also
  // measures on mount, so re-opening a card shows an existing multi-line caption
  // at full height instead of clipping it to one line until you type.
  const { setRef: captionRef, fit: autosizeCaption } = useAutosizeRef(caption);
  
  // Initialize without empty items, just content
  const [references, setReferences] = useState<MediaItem[]>((content?.references || []).filter((i: MediaItem) => i.type !== 'empty'));
  const [finalAssets, setFinalAssets] = useState<MediaItem[]>((content?.finalAssets || []).filter((i: MediaItem) => i.type !== 'empty'));
  
  const [taskLists, setTaskLists] = useState<TaskList[]>(content?.taskLists || []);
  // Comments live in the board chat drawer; never keep a local copy (a stale copy
  // written back in the commits below would clobber drawer edits/resolves).

  // Drive State
  const [driveInfo, setDriveInfo] = useState({
    synced: !!content?.driveFolderId,
    url: content?.driveFolderUrl || 'https://drive.google.com'
  });

  // Debounced Sync Effect to update Parent Component
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentContent = {
        ...card.content,
        sku,
        title,
        date: internalDate,
        status: postStatus,
        caption,
        references,
        finalAssets,
        taskLists,
        driveFolderId: driveInfo.synced ? (content?.driveFolderId || 'mock-id') : undefined,
        driveFolderUrl: driveInfo.url
      };

      // Simple deep check to prevent unnecessary updates if data hasn't changed (prevents loops)
      if (JSON.stringify(currentContent) !== JSON.stringify(card.content)) {
          onUpdateContent(card.id, currentContent);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [sku, title, internalDate, postStatus, caption, references, finalAssets, taskLists, driveInfo, card.content, card.id, onUpdateContent]);


  const [previewContext, setPreviewContext] = useState<{ item: MediaItem; list: MediaItem[] } | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Brand identity for the Instagram mockup — matches the Feed profile of the
  // workspace we're in, not "Orbit Brand".
  const igProfile = useMockupProfile('instagram');
  const scheduledCount = (content?.publishTargets || []).filter(t => t.status === 'scheduled' || t.status === 'needs_action').length;

  // Media changes (add/pin/reorder/remove) are discrete, important, and often
  // followed immediately by leaving the whiteboard — which unmounts this card and
  // clears the 800ms debounce timer above, losing the pending write. So we commit
  // those changes synchronously here (the debounce still handles text fields).
  const commitContent = (overrides: any = {}) => {
    onUpdateContent(card.id, {
      ...card.content,
      sku,
      title,
      date: internalDate,
      status: postStatus,
      caption,
      references,
      finalAssets,
      taskLists,
      driveFolderId: driveInfo.synced ? (content?.driveFolderId || 'mock-id') : undefined,
      driveFolderUrl: driveInfo.url,
      ...overrides,
    });
  };

  const addTaskList = () => {
    const colors: TaskList['color'][] = ['blue', 'green', 'yellow', 'red', 'gray'];
    const nextColor = colors[taskLists.length % colors.length];
    
    const newList: TaskList = { id: Date.now().toString(), title: 'New List', color: nextColor, items: [] };
    setTaskLists([...taskLists, newList]);
  };

  const handleMediaUpload = (files: File[], listType: 'references' | 'finalAssets') => {
    const currentList = listType === 'references' ? references : finalAssets;
    const setList = listType === 'references' ? setReferences : setFinalAssets;

    const allowed = files.filter(f => {
      if (!isWithinMediaLimit(f)) { alert(mediaLimitMessage()); return false; }
      return true;
    });
    if (allowed.length === 0) return;

    // Optimistic: insert items immediately with an instant local preview, then
    // upload each in the background and swap in the persisted Storage URL.
    const uploads = allowed.map(file => {
      const { previewUrl, promise, posterPromise } = beginMediaUpload(file);
      const item: MediaItem = {
        id: `media-${Date.now()}-${Math.random()}`,
        type: file.type.startsWith('video') ? 'video' : 'image',
        url: previewUrl,
        uploading: true,
      };
      return { item, previewUrl, promise, posterPromise };
    });

    const newList = [...currentList, ...uploads.map(u => u.item)];
    setList(newList);
    commitContent({ [listType]: newList });

    uploads.forEach(({ item, previewUrl, promise, posterPromise }) => {
      promise
        .then(finalUrl => {
          setList(prev => {
            const next = prev.map(i => i.id === item.id ? { ...i, url: finalUrl, uploading: false } : i);
            commitContent({ [listType]: next });
            return next;
          });
        })
        .finally(() => { try { URL.revokeObjectURL(previewUrl); } catch { /* already revoked */ } });
      // Poster resolves independently of the upload — merge it in on its own.
      posterPromise.then(thumb => {
        if (!thumb) return;
        setList(prev => {
          const next = prev.map(i => i.id === item.id ? { ...i, thumbnail: thumb } : i);
          commitContent({ [listType]: next });
          return next;
        });
      });
    });
  };

  // Add already-resolved media (e.g. an on-board image/video copied then pasted
  // over this slot) directly by URL — no re-upload.
  const addMediaItems = (items: { type: 'image' | 'video'; url: string }[], listType: 'references' | 'finalAssets') => {
    const usable = items.filter(it => !!it.url);
    if (usable.length === 0) return;
    const currentList = listType === 'references' ? references : finalAssets;
    const setList = listType === 'references' ? setReferences : setFinalAssets;
    const newItems: MediaItem[] = usable.map((it, i) => ({
      id: `media-${Date.now()}-${i}-${Math.round(Math.random() * 1e4)}`,
      type: it.type,
      url: it.url,
    }));
    const newList = [...currentList, ...newItems];
    setList(newList);
    commitContent({ [listType]: newList });
  };

  const handlePinDropped = (url: string, link: string, listType: 'references' | 'finalAssets') => {
      const currentList = listType === 'references' ? references : finalAssets;
      const setList = listType === 'references' ? setReferences : setFinalAssets;

      const newItem: MediaItem = {
          id: `pin-${Date.now()}`,
          type: 'image',
          url: url,
          sourceLink: link
      };
      const newList = [...currentList, newItem];
      setList(newList);
      commitContent({ [listType]: newList });
  };

  const handleReorder = (dragIndex: number, hoverIndex: number, listType: 'references' | 'finalAssets') => {
    const currentList = listType === 'references' ? references : finalAssets;
    const setList = listType === 'references' ? setReferences : setFinalAssets;
    
    const newList = [...currentList];
    const [removed] = newList.splice(dragIndex, 1);
    newList.splice(hoverIndex, 0, removed);

    setList(newList);
    commitContent({ [listType]: newList });
  };

  // Paste-to-slot: Canvas dispatches `sosa:paste-media` onto the hovered zone when
  // the user Ctrl+V's an image over the References / Final Assets area. We add the
  // file(s) exactly like a manual upload (optimistic, via handleMediaUpload).
  const handleZonePaste = (e: Event, listType: 'references' | 'finalAssets') => {
    const detail = (e as CustomEvent).detail || {};
    if (detail.items?.length) addMediaItems(detail.items, listType);       // on-board media (URL)
    else if (detail.files?.length) handleMediaUpload(detail.files, listType); // system files
  };
  const referencesZoneRef = useRef<HTMLDivElement>(null);
  const finalsZoneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const refsEl = referencesZoneRef.current;
    const finalsEl = finalsZoneRef.current;
    const onRefs = (e: Event) => handleZonePaste(e, 'references');
    const onFinals = (e: Event) => handleZonePaste(e, 'finalAssets');
    refsEl?.addEventListener('sosa:paste-media', onRefs);
    finalsEl?.addEventListener('sosa:paste-media', onFinals);
    return () => {
      refsEl?.removeEventListener('sosa:paste-media', onRefs);
      finalsEl?.removeEventListener('sosa:paste-media', onFinals);
    };
  });

  // Card-wide fallback: pasting media anywhere over the card (even collapsed, or
  // over the title/caption) routes to References; the specific References /
  // Final Assets sections above take precedence via closest('[data-paste-zone]').
  // React 19 ref-cleanup: rebinds with fresh state each render.
  const cardPasteRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: Event) => handleZonePaste(e, 'references');
    node.addEventListener('sosa:paste-media', handler);
    return () => node.removeEventListener('sosa:paste-media', handler);
  };

  // Collapse every post when it isn't selected → clean board overview.
  // Unless pinned "keep expanded" via the right-click menu.
  // A card expands only when it's the SOLE selection. Multi-selecting (marquee or
  // shift-click) keeps every card in its current collapsed/expanded state.
  const isCollapsed = !props.isExpanded && !card.alwaysExpanded && !props.isFullscreen;

  // Determine which assets to preview in collapsed mode (Final Assets > References).
  const previewAssets = finalAssets.length > 0 ? finalAssets : references;
  const hasAssets = previewAssets.length > 0;

  return (
    <>
      <BaseCard
        {...props}
        title={isCollapsed ? (title || 'Untitled Post') : sku}
        compact={isCollapsed}
        headerRight={isCollapsed ? (<><DateChip date={displayDate} /><StatusChip status={postStatus} /></>) : undefined}
        icon={isLinked ? <LinkIcon size={16} className="text-[#3A5C34]"/> : <FileImage size={16} className="text-gray-400"/>}
      >
        <div ref={cardPasteRef} data-paste-zone="references" className={isCollapsed ? "flex flex-col" : "flex flex-col h-full"}>

          {/* Collapsed Mode — name/date/status live in the header row now. */}
          {isCollapsed ? (
            <div className="space-y-3 pt-1 pb-1 pointer-events-none select-none animate-in fade-in duration-300">

               {/* Asset Preview (Finals or References) */}
               {hasAssets ? (
                 <div className="grid grid-cols-4 gap-2">
                   {previewAssets.slice(0, 8).map((item) => (
                     <div key={item.id} className="aspect-square rounded-md overflow-hidden bg-gray-100 relative shadow-sm ring-1 ring-black/5">
                        {item.type === 'image' && <img src={item.url} className="w-full h-full object-cover" />}
                        {item.type === 'video' && (
                            // Show a real video frame (or poster thumbnail) instead of a black box.
                            <>
                                {item.thumbnail
                                    ? <img src={item.thumbnail} className="w-full h-full object-cover" />
                                    : <VideoThumb url={item.url} thumbnail={item.thumbnail} />}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Video size={12} className="text-white drop-shadow" />
                                </div>
                            </>
                        )}
                        {item.type === 'link' && (
                            <div className="w-full h-full bg-blue-50 flex items-center justify-center text-[#3A5C34]">
                                <LinkIcon size={12} />
                            </div>
                        )}
                     </div>
                   ))}
                   {previewAssets.length > 8 && (
                     <div className="aspect-square rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                       +{previewAssets.length - 8}
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="py-2 flex items-center gap-2 opacity-50">
                    <div className="w-8 h-8 rounded-md bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                       <ImageIcon size={14} className="text-gray-400"/>
                    </div>
                    <span className="text-[12px] text-gray-400 italic">No assets yet</span>
                 </div>
               )}

               {/* Caption Preview */}
               {caption && (
                  <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-3 font-medium">
                    {caption}
                  </p>
               )}
            </div>
          ) : (
            // Expanded / Normal Mode
            <>
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                  
                  {/* Title Block */}
                  <div className="space-y-2">
                    <input
                      // Opening the card puts the caret here (see BaseCard).
                      data-card-focus
                      className="w-full font-bold text-[28px] leading-tight text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 no-drag cursor-text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => commitContent({ title })}
                      placeholder="Post Title"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Enhanced Date & Status Row */}
                    <div className="flex items-center justify-between pt-2 pb-4">
                        {/* Date */}
                        <div className={`
                            relative flex items-center gap-1.5 transition-all
                            ${isLinked 
                                ? 'text-[#3A5C34]' 
                                : 'text-gray-400 hover:text-gray-600'
                            }
                        `}>
                            <Calendar size={13} />
                            <span className={`text-[12px] font-medium ${isLinked ? 'text-[#3A5C34]' : 'text-gray-500'}`}>
                                {displayDate ? new Date(displayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Add date"}
                            </span>
                            <input 
                                type="date" 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={displayDate}
                                onChange={(e) => !isLinked && setInternalDate(e.target.value)} // Prevent edit if linked
                                onClick={(e) => e.stopPropagation()}
                                disabled={isLinked} // Lock if linked
                            />
                            
                            {/* Sync Badge */}
                            {isLinked && (
                                <div className="flex items-center gap-1 pl-1.5 ml-1 border-l border-[#3A5C34]/20">
                                    <LayoutGrid size={11} className="text-[#3A5C34]" />
                                    <span className="text-[9px] font-bold tracking-wide uppercase text-[#3A5C34]">Synced</span>
                                </div>
                            )}
                        </div>

                        {/* Status Badge */}
                        <StatusPill status={postStatus} onChange={setPostStatus} />
                    </div>
                  </div>

                  {/* References */}
                  <div ref={referencesZoneRef} data-paste-zone="references">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-semibold text-gray-400">References</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {references.map((item, i) => (
                        <MediaCube 
                          key={item.id} 
                          item={item} 
                          index={i} 
                          listType="references"
                          onRemove={() => { const nl = references.filter(r => r.id !== item.id); setReferences(nl); commitContent({ references: nl }); }}
                          onUpdate={(updated) => { const nl = references.map(r => r.id === item.id ? updated : r); setReferences(nl); commitContent({ references: nl }); }}
                          onFilesSelected={(files) => handleMediaUpload(files, 'references')}
                          onPreview={() => setPreviewContext({ item, list: references })}
                          onDropItem={handleReorder}
                        />
                      ))}
                      <AddMediaButton 
                        onFilesSelected={(files) => handleMediaUpload(files, 'references')}
                        onPinDropped={(url, link) => handlePinDropped(url, link, 'references')}
                      />
                    </div>
                  </div>

                  {/* Caption */}
                  <div>
                    <span className="text-[13px] font-semibold text-gray-400 mb-2 block">Caption</span>
                    <textarea
                      ref={captionRef}
                      className="w-full text-[15px] leading-relaxed text-gray-900 bg-transparent border-none p-0 resize-none overflow-hidden focus:ring-0 placeholder-gray-300 no-drag cursor-text block"
                      rows={1}
                      placeholder="Type caption here..."
                      value={caption}
                      onChange={(e) => { setCaption(e.target.value); autosizeCaption(); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Checklists */}
                  <div>
                    {taskLists.map(list => (
                        <TaskListBlock 
                          key={list.id} 
                          list={list} 
                          onUpdate={(updated) => setTaskLists(taskLists.map(l => l.id === list.id ? updated : l))}
                          onDelete={() => setTaskLists(taskLists.filter(l => l.id !== list.id))}
                        />
                      ))}
                    <button 
                      onClick={(e) => { e.stopPropagation(); addTaskList(); }}
                      className="flex items-center gap-2 text-[15px] text-gray-400 hover:text-[#3A5C34] transition-colors mt-2"
                    >
                      <Plus size={16} /> Add Checklist
                    </button>
                  </div>

                  {/* Final Assets */}
                  <div ref={finalsZoneRef} data-paste-zone="finalAssets" className="pt-4 border-t border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-400 mb-3 block">Final Assets</span>
                    <div className="grid grid-cols-4 gap-3">
                      {finalAssets.map((item, i) => (
                        <MediaCube 
                          key={item.id} 
                          item={item} 
                          index={i} 
                          listType="finalAssets"
                          onRemove={() => { const nl = finalAssets.filter(r => r.id !== item.id); setFinalAssets(nl); commitContent({ finalAssets: nl }); }}
                          onUpdate={(updated) => { const nl = finalAssets.map(r => r.id === item.id ? updated : r); setFinalAssets(nl); commitContent({ finalAssets: nl }); }}
                          onFilesSelected={(files) => handleMediaUpload(files, 'finalAssets')}
                          onPreview={() => setPreviewContext({ item, list: finalAssets })}
                          onDropItem={handleReorder}
                        />
                      ))}
                      <AddMediaButton 
                        onFilesSelected={(files) => handleMediaUpload(files, 'finalAssets')}
                        onPinDropped={(url, link) => handlePinDropped(url, link, 'finalAssets')}
                      />
                    </div>
                  </div>
              </div>

              {/* Action Bar */}
              <FullscreenFooterRow>
                {/* Left: real assignees from the brand roster */}
                <AssigneeStack
                  assigneeIds={content?.assignees || []}
                  onChange={(ids) => onUpdateContent(card.id, { ...content, assignees: ids })}
                />

                {/* Right: Tools (Preview + Schedule) */}
                <div className="flex items-center gap-2">
                  <PreviewButton onClick={(e) => { e.stopPropagation(); setShowPreview(true); }} title="Preview post" />

                  {/* Schedule to social platforms */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPublishModalOpen(true); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Schedule publish"
                    className={`relative w-9 h-9 rounded-full transition-all flex items-center justify-center ${scheduledCount > 0 ? 'bg-[#3A5C34] text-white' : 'bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
                  >
                    <Send size={16} />
                    {scheduledCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FFD753] text-[#5F2427] text-[10px] font-bold flex items-center justify-center">
                        {scheduledCount}
                      </span>
                    )}
                  </button>
                </div>
              </FullscreenFooterRow>
            </>
          )}
        </div>
      </BaseCard>

      {/* Media Lightbox */}
      {previewContext && (
        <MediaPreviewOverlay
          initialItem={previewContext.item}
          items={previewContext.list}
          onClose={() => setPreviewContext(null)}
        />
      )}

      {/* Schedule publish */}
      {publishModalOpen && (
        <PublishModal
          card={card}
          onSave={(targets) => onUpdateContent(card.id, { ...content, publishTargets: targets })}
          onClose={() => setPublishModalOpen(false)}
        />
      )}

      {/* Instagram mockup preview — brand identity from the active workspace */}
      {showPreview && (
        <InstagramPreviewModal
          post={card}
          onClose={() => setShowPreview(false)}
          brandName={igProfile.displayName}
          username={igProfile.username}
          avatarUrl={igProfile.avatarUrl}
        />
      )}
    </>
  );
};