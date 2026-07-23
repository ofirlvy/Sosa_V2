
import React, { useState, useEffect, useMemo } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, CardType, GridConfig, GridPlannerContent, MediaItem, PostCardContent, ReelsCardContent } from '../../types';
import { Settings, X, LayoutGrid, ChevronRight, Calendar, Check, Minus, Plus, Link, FileImage } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { InstagramPreviewModal } from '../modals/InstagramPreviewModal';
import { buildSlots } from '../../services/gridPlanner';
import { VideoThumb } from '../media/VideoThumb';

interface GridPlannerCardProps {
  card: CardData;
  allCards: CardData[];
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onUnlink: (gridId: string, slotIndex: number, postCardId: string) => void;
  onLinkPost: (gridId: string, slotIndex: number, postId: string) => void;
  onSwapSlots: (gridId: string, slotIndexA: number, slotIndexB: number) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  hoveredSlotIndex?: number | null;
  zoomScale: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GridPlannerCard: React.FC<GridPlannerCardProps> = (props) => {
  const { card, allCards, onUpdateContent, onUnlink, onLinkPost, onSwapSlots, hoveredSlotIndex, onResize } = props;
  const content = card.content as GridPlannerContent;
  
  const [viewMode, setViewMode] = useState<'grid' | 'settings'>('grid');
  const [linkingSlotIndex, setLinkingSlotIndex] = useState<number | null>(null);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const previewPost = useMemo(() => {
    return previewPostId ? allCards.find(c => c.id === previewPostId) : null;
  }, [previewPostId, allCards]);
  
  const defaultConfig: GridConfig = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    logicType: 'frequency',
    value: 3
  };

  const [tempConfig, setTempConfig] = useState<GridConfig>(content.config || defaultConfig);

  useEffect(() => {
    if (!content.config) {
      onUpdateContent(card.id, {
        ...content,
        title: "Feed Planner",
        connections: {},
        config: defaultConfig
      });
    }
  }, []);

  const handleSaveSettings = () => {
    onUpdateContent(card.id, { ...content, config: tempConfig });
    setViewMode('grid');
  };

  // Posts AND Reels are slot-linkable (a feed mixes both).
  const availablePosts = useMemo(() => {
    const connectedPostIds = Object.values(content.connections || {});
    return allCards.filter(c =>
        (c.type === CardType.POST || c.type === CardType.REELS) &&
        !connectedPostIds.includes(c.id)
    );
  }, [allCards, content.connections]);

  // Slot/list preview media for a linkable card: Post → final assets/references;
  // Reel → its 9:16 cover.
  const cardPreviewMedia = (c: CardData) => {
    if (c.type === CardType.REELS) return (c.content as ReelsCardContent).cover || null;
    const pc = c.content as PostCardContent;
    return pc.finalAssets?.[0] || pc.references?.[0] || null;
  };

  // Slots come from the shared planner logic (config-generated + any extra
  // dated slots created by calendar rescheduling), sorted by date.
  const slots = useMemo(() => buildSlots(content), [content]);

  // Display slots in reverse order (latest date first) for Instagram-style feed
  const displaySlots = useMemo(() => [...slots].reverse(), [slots]);

  // Dynamic Height Calculation
  useEffect(() => {
    if (!onResize) return;

    if (viewMode === 'settings') {
        const settingsHeight = 520; // Fixed height for settings view
        if (Math.abs(card.height - settingsHeight) > 2) {
            onResize(card.id, { width: card.width, height: settingsHeight });
        }
        return;
    }

    const colCount = 3;
    const gap = 12; // gap-3
    const paddingX = 40; // px-5 * 2
    const availableWidth = card.width - paddingX;
    const colWidth = (availableWidth - (gap * (colCount - 1))) / colCount;
    const rowHeight = colWidth * (5/4); // aspect 4/5
    
    const rowCount = Math.ceil(slots.length / colCount);
    
    // Height Breakdown:
    // BaseCard Header: ~52px (approx 20+20+8+padding)
    // Grid Top Padding: 16px (pt-4)
    // Grid Bottom Padding: 8px (pb-2)
    // Grid Row Content: rowCount * rowHeight
    // Grid Gaps: (rowCount - 1) * gap
    // Footer: 69px (border 1 + padding 32 + height 36)
    
    const headerHeight = 52;
    const footerHeight = 69;
    const containerPadding = 24;
    const gridGaps = Math.max(0, rowCount - 1) * gap;
    const gridContent = rowCount * rowHeight;
    const buffer = 10; // little extra breathing room

    const totalHeight = headerHeight + containerPadding + gridContent + gridGaps + footerHeight + buffer;

    // Ensure we don't shrink below a usable size for the Settings view.
    // Round to a whole pixel so the value converges (fractional rowHeight caused
    // an infinite resize→re-render loop, manifesting as flicker).
    const minHeight = 500;
    const finalHeight = Math.round(Math.max(minHeight, totalHeight));

    if (Math.abs(card.height - finalHeight) > 2) {
        onResize(card.id, { width: card.width, height: finalHeight });
    }
  }, [slots.length, card.width, card.height, onResize, viewMode]);

  // --- Drag and Drop Handlers for Slots ---

  const handleSlotDragStart = (e: React.DragEvent, slotIndex: number) => {
    e.stopPropagation();
    setDraggedSlotIndex(slotIndex);
    // Identifiable data payload for the grid slot drag
    e.dataTransfer.setData('application/json', JSON.stringify({ 
        type: 'GRID_SLOT_REORDER', 
        gridId: card.id, 
        index: slotIndex 
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
  };

  const handleSlotDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggedSlotIndex(null);
      
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      
      try {
          const data = JSON.parse(dataStr);
          // Only process drops originating from the same grid for now
          if (data.type === 'GRID_SLOT_REORDER' && data.gridId === card.id) {
              if (data.index !== targetIndex) {
                  onSwapSlots(card.id, data.index, targetIndex);
                  soundService.play('snap'); // Sound Feedback
              }
          }
      } catch (err) {
          // ignore
      }
  };

  const renderGridView = () => (
    <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-300">
        {/* Editable title */}
        <div className="px-5 pt-3 shrink-0">
          <input
            value={content.title || ''}
            dir="auto"
            placeholder="Feed Planner"
            onChange={(e) => onUpdateContent(card.id, { ...content, title: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full text-[15px] font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 no-drag"
          />
        </div>
        {/* Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2 no-scrollbar min-h-0 relative">
            <div className="grid grid-cols-3 gap-3 auto-rows-min pb-4">
                {displaySlots.map((slot) => {
                // slot.index is the logical index (0 = start of month, N = end of month)
                const connectedCardId = content.connections?.[slot.index];
                const connectedCard = connectedCardId ? allCards.find(c => c.id === connectedCardId) : null;
                
                let previewMedia: MediaItem | undefined;
                if (connectedCard) {
                    previewMedia = cardPreviewMedia(connectedCard);
                }

                const isHovered = hoveredSlotIndex === slot.index;
                const isDraggingThis = draggedSlotIndex === slot.index;

                return (
                    <div 
                        key={slot.index}
                        className={`
                            aspect-[4/5] rounded-xl relative group transition-all duration-200 ease-out
                            ${connectedCard 
                                ? 'bg-white shadow-sm ring-1 ring-black/5 hover:ring-[#3A5C34] hover:shadow-md cursor-pointer' 
                                : 'bg-white border border-dashed border-gray-300 hover:border-[#3A5C34] hover:bg-[#FCCAE2]/20 cursor-grab active:cursor-grabbing'
                            }
                            ${isHovered ? 'ring-2 ring-[#3A5C34] border-transparent scale-[1.02] z-20 shadow-lg' : ''}
                            ${isDraggingThis ? 'opacity-30' : 'opacity-100'}
                            no-drag
                        `}
                        draggable
                        onDragStart={(e) => handleSlotDragStart(e, slot.index)}
                        onDragOver={handleSlotDragOver}
                        onDrop={(e) => handleSlotDrop(e, slot.index)}
                        onDragEnd={() => setDraggedSlotIndex(null)}
                        onClick={(e) => {
                            if (connectedCard) {
                                e.stopPropagation();
                                setPreviewPostId(connectedCard.id);
                            }
                        }}
                    >
                        {connectedCard ? (
                            <>
                                {previewMedia?.type === 'image' && (
                                    <img src={previewMedia.url} className="w-full h-full object-cover rounded-xl select-none pointer-events-none" />
                                )}
                                {previewMedia?.type === 'video' && (
                                    <VideoThumb url={previewMedia.url} thumbnail={previewMedia.thumbnail} className="w-full h-full object-cover rounded-xl select-none pointer-events-none" />
                                )}
                                {!previewMedia && (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gray-50 rounded-xl">
                                        <LayoutGrid size={20} className="text-gray-300 mb-1" />
                                        <span className="text-[9px] font-semibold text-gray-500 line-clamp-2 leading-tight">
                                            {(connectedCard.content as PostCardContent).title || "Untitled"}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onUnlink(card.id, slot.index, connectedCard.id); }}
                                        className="w-5 h-5 bg-white/90 backdrop-blur rounded-full text-red-500 shadow-sm flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                    >
                                        <X size={10} strokeWidth={3} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                {/* Link Button */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setLinkingSlotIndex(slot.index); }}
                                    className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-[#3A5C34] hover:scale-110 active:scale-95 transition-all"
                                    title="Link to existing post"
                                >
                                    <Link size={14} />
                                </button>
                                
                                {isHovered && <div className="absolute bottom-2 text-[#3A5C34] font-bold text-[10px] animate-pulse pointer-events-none">DROP</div>}
                            </div>
                        )}

                        <div className={`
                            absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight shadow-sm pointer-events-none
                            ${connectedCard ? 'bg-black/60 text-white backdrop-blur-md' : 'bg-white text-gray-400 ring-1 ring-black/5'}
                        `}>
                            {slot.label}{connectedCard?.type === CardType.REELS ? ' · Reel' : ''}
                        </div>
                    </div>
                );
                })}
            </div>

            {/* Post Selection Overlay */}
            {linkingSlotIndex !== null && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 animate-in fade-in duration-200 flex flex-col p-4 no-drag cursor-auto">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[13px] font-semibold text-gray-900">
                             Link Post to {slots.find(s => s.index === linkingSlotIndex)?.date.getDate()}, {MONTHS[slots.find(s => s.index === linkingSlotIndex)?.date.getMonth() ?? 0]} Slot
                        </span>
                        <button 
                            onClick={() => setLinkingSlotIndex(null)}
                            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                        {availablePosts.length === 0 ? (
                            <div className="h-32 flex flex-col items-center justify-center text-gray-400 text-center">
                                <FileImage size={24} className="mb-2 opacity-30" />
                                <span className="text-[12px]">No unlinked posts found on the board.</span>
                            </div>
                        ) : (
                            availablePosts.map(post => {
                                const isReel = post.type === CardType.REELS;
                                const media = cardPreviewMedia(post);
                                return (
                                <button
                                    key={post.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLinkPost(card.id, linkingSlotIndex, post.id);
                                        setLinkingSlotIndex(null);
                                        soundService.play('snap'); // Sound Feedback
                                    }}
                                    className="w-full p-3 rounded-xl border border-gray-100 bg-white hover:border-[#3A5C34] hover:bg-[#FCCAE2]/10 transition-all flex items-center gap-3 group text-left shadow-sm"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 overflow-hidden">
                                        {media?.url ? (
                                            media.type === 'image' ? (
                                                <img src={media.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <VideoThumb url={media.url} thumbnail={media.thumbnail} />
                                            )
                                        ) : (
                                            <FileImage size={16} />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-gray-900 truncate group-hover:text-[#3A5C34]">
                                            {(post.content as PostCardContent).title || (isReel ? "Untitled Reel" : "Untitled Post")}
                                        </div>
                                        <div className="text-[11px] text-gray-400 truncate">
                                            {isReel ? 'Reel' : ((post.content as PostCardContent).sku || "No SKU")}
                                        </div>
                                    </div>
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 text-[#3A5C34] transition-opacity">
                                        <Check size={16} />
                                    </div>
                                </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Footer / Action Bar */}
        <div className="mt-auto px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
                 <div className="h-8 px-3 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[13px] font-semibold text-gray-600 shadow-sm gap-2">
                    <Calendar size={13} className="text-gray-400"/>
                    <span className="uppercase tracking-wide">{MONTHS[content.config?.month || 0]} {content.config?.year}</span>
                 </div>
                 
                 <div className="h-8 px-3 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[13px] font-semibold text-gray-600 shadow-sm">
                    {slots.length} Posts
                 </div>
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); setTempConfig(content.config || defaultConfig); setViewMode('settings'); }}
                    className="w-9 h-9 rounded-full bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all flex items-center justify-center active:scale-95"
                >
                    <Settings size={18} />
                </button>
            </div>
        </div>
    </div>
  );

  const renderSettingsView = () => (
    <div className="flex flex-col h-full bg-white relative animate-in slide-in-from-right-8 duration-300 ease-out">
        {/* Settings Form */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 no-scrollbar">
            
            {/* Timeframe Section */}
            <div>
                <span className="text-[13px] font-semibold text-gray-400 block mb-3 uppercase tracking-wide">Timeframe</span>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-400 ml-1">Month</label>
                        <div className="relative">
                            <select 
                                className="w-full bg-gray-50 border-none rounded-xl py-2.5 px-3 text-[14px] font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#3A5C34]/20 appearance-none cursor-pointer"
                                value={tempConfig.month}
                                onChange={e => setTempConfig({...tempConfig, month: parseInt(e.target.value)})}
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-400 ml-1">Year</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-50 border-none rounded-xl py-2.5 px-3 text-[14px] font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#3A5C34]/20 placeholder-gray-400"
                            value={tempConfig.year}
                            onChange={e => setTempConfig({...tempConfig, year: parseInt(e.target.value)})}
                        />
                    </div>
                </div>
            </div>

            {/* Cadence Section */}
            <div>
                <span className="text-[13px] font-semibold text-gray-400 block mb-3 uppercase tracking-wide">Cadence</span>
                
                {/* Switcher */}
                <div className="bg-gray-100 p-1 rounded-xl flex mb-4">
                    <button 
                        className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-all ${tempConfig.logicType === 'frequency' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setTempConfig({...tempConfig, logicType: 'frequency'})}
                    >
                        Frequency
                    </button>
                    <button 
                        className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-all ${tempConfig.logicType === 'count' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setTempConfig({...tempConfig, logicType: 'count'})}
                    >
                        Total Count
                    </button>
                </div>

                {/* Counter Control */}
                <div className="flex items-center justify-between p-1">
                    <span className="text-[15px] font-medium text-gray-700">
                         {tempConfig.logicType === 'frequency' ? 'Every X Days' : 'Total Posts'}
                    </span>
                    <div className="flex items-center gap-3">
                        <button 
                            className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                            onClick={() => setTempConfig({...tempConfig, value: Math.max(1, tempConfig.value - 1)})}
                        >
                            <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <span className="w-8 text-center font-bold text-[17px] text-gray-900 tabular-nums">{tempConfig.value}</span>
                        <button 
                            className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                            onClick={() => setTempConfig({...tempConfig, value: tempConfig.value + 1})}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
                 <p className="text-[12px] text-gray-400 mt-3 leading-relaxed border-t border-gray-50 pt-3">
                    {tempConfig.logicType === 'frequency' 
                        ? `This will automatically create a post slot every ${tempConfig.value} days starting from the 1st.` 
                        : `This will distribute ${tempConfig.value} post slots evenly across the selected month.`}
                </p>
            </div>
        </div>

        {/* Footer / Action Bar (Identical to Front) */}
        <div className="mt-auto px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
             {/* Left - Status */}
             <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[#3A5C34]"></div>
                 <span className="text-[13px] font-medium text-gray-400">Changes Saved</span>
             </div>

            {/* Right - Toggle Button (Back) */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveSettings(); }}
                    className="w-9 h-9 rounded-full bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all flex items-center justify-center active:scale-95"
                >
                    <LayoutGrid size={18} />
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <>
        <BaseCard 
        {...props} 
        title={content.title || "Feed Planner"} 
        // Changed from Blue to Forest Green
        icon={<LayoutGrid size={16} className="text-[#3A5C34]"/>}
        >
        {viewMode === 'grid' ? renderGridView() : renderSettingsView()}
        </BaseCard>

        {previewPost && (
            <InstagramPreviewModal 
                post={previewPost} 
                onClose={() => setPreviewPostId(null)}
            />
        )}
    </>
  );
};
