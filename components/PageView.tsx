
import React, { useState } from 'react';
import { FileSystemNode, BrandMember } from '../types';
import { OrbitLogo } from './ui/OrbitLogo';
import { BoardThumbnail } from './BoardThumbnail';
import { initials as memberInitials } from '../services/brandMembers';

// A whiteboard has visible content when any of its workspaces holds a card.
const boardHasCards = (wb: FileSystemNode): boolean =>
  (wb.whiteboardData || []).some(w => (w.cards || []).length > 0);
import { 
  Clock, 
  Star, 
  Plus, 
  Folder, 
  Search, 
  Grid2X2, 
  List as ListIcon, 
  LayoutTemplate,
  MoreHorizontal,
  X,
  Compass,
  UserPlus
} from 'lucide-react';

interface PageViewProps {
  node: FileSystemNode;
  childNodes: FileSystemNode[];
  breadcrumbs?: { id: string, name: string }[];
  onNavigate: (id: string) => void;
  onCreateWhiteboard: () => void;
  onCreateFolder: () => void;
  onToggleFavorite?: (id: string) => void;
  onUpdateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  onReorderNode?: (dragId: string, targetId: string) => void;
  tourCompleted?: boolean;
  onDismissTour?: () => void;
  /** Active brand roster (owner + members) for the header facepile. */
  roster?: BrandMember[];
  onShare?: () => void;
}

// --- COLOR UTILS ---
// Deterministically assign a brand color theme based on the ID string
const getBrandTheme = (id: string) => {
  const themes = [
    // Yellow Theme
    { 
      bg: 'bg-[#FFD753]/20', 
      text: 'text-[#b89514]', 
      border: 'hover:border-[#FFD753]', 
      icon: '#d9b01c',
      shadow: 'hover:shadow-[#FFD753]/20'
    },
    // Green Theme
    { 
      bg: 'bg-[#3A5C34]/10', 
      text: 'text-[#3A5C34]', 
      border: 'hover:border-[#3A5C34]', 
      icon: '#3A5C34',
      shadow: 'hover:shadow-[#3A5C34]/20'
    },
    // Pink Theme
    { 
      bg: 'bg-[#FCCAE2]/40', 
      text: 'text-[#5F2427]', 
      border: 'hover:border-[#FCCAE2]', 
      icon: '#5F2427',
      shadow: 'hover:shadow-[#FCCAE2]/40'
    },
    // Burgundy Theme
    { 
      bg: 'bg-[#5F2427]/10', 
      text: 'text-[#5F2427]', 
      border: 'hover:border-[#5F2427]', 
      icon: '#5F2427',
      shadow: 'hover:shadow-[#5F2427]/20'
    },
  ];
  
  if (!id) return themes[0];
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % themes.length;
  return themes[index];
};

export const PageView: React.FC<PageViewProps> = ({
  node,
  childNodes,
  breadcrumbs = [],
  onNavigate,
  onCreateWhiteboard,
  onCreateFolder,
  onToggleFavorite,
  onUpdateNode,
  onReorderNode,
  tourCompleted,
  onDismissTour,
  roster = [],
  onShare
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Renaming State (Grid Items)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Renaming State (Header)
  const [isRenamingHeader, setIsRenamingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");

  const whiteboards = childNodes.filter(n => n.type === 'whiteboard');
  const folders = childNodes.filter(n => n.type !== 'whiteboard');

  const filteredWhiteboards = whiteboards.filter(n => (n.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFolders = folders.filter(n => (n.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  // Don't show "Create" buttons in special views like Recents/Favorites unless appropriate
  const isSpecialView = ['recents', 'favorites'].includes(node.id);
  const isRoot = node.id === 'root';

  // --- Grid Renaming Handlers ---
  const handleStartRenaming = (e: React.MouseEvent, item: FileSystemNode) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleSaveRenaming = () => {
    if (editingId && editName.trim()) {
      onUpdateNode(editingId, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRenaming();
    if (e.key === 'Escape') setEditingId(null);
  };

  // --- Header Renaming Handlers ---
  const handleStartHeaderRenaming = () => {
    if (isSpecialView) return;
    setIsRenamingHeader(true);
    setHeaderName(node.name);
  };

  const handleSaveHeaderRenaming = () => {
    if (headerName.trim()) {
      onUpdateNode(node.id, { name: headerName.trim() });
    }
    setIsRenamingHeader(false);
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveHeaderRenaming();
    if (e.key === 'Escape') setIsRenamingHeader(false);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      if (editingId || isRenamingHeader) {
          e.preventDefault();
          return;
      }
      setDraggedItemId(id);
      e.dataTransfer.setData('nodeId', id);
      e.dataTransfer.effectAllowed = 'move';
      if (e.target instanceof HTMLElement) {
          e.target.style.opacity = '0.5';
      }
  };

  const handleDragEnd = (e: React.DragEvent) => {
      setDraggedItemId(null);
      if (e.target instanceof HTMLElement) {
          e.target.style.opacity = '1';
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('nodeId');
      if (dragId && dragId !== targetId && onReorderNode) {
          onReorderNode(dragId, targetId);
      }
      setDraggedItemId(null);
  };

  return (
    <div className="flex-1 bg-white h-full overflow-y-auto no-scrollbar font-sans selection:bg-[#FCCAE2] selection:text-[#5F2427]">
      <div className="max-w-[1400px] mx-auto p-8 lg:p-12">
        
        {/* --- TOUR CARD --- */}
        {isRoot && !tourCompleted && onDismissTour && (
            <div className="mb-10 bg-[#3A5C34] text-white rounded-[24px] p-6 shadow-xl relative animate-in slide-in-from-top-4 fade-in duration-500 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="flex items-center gap-2 text-[#FFD753] font-bold text-[11px] uppercase tracking-wider">
                            <Compass size={14} /> Getting Started
                        </div>
                        <h2 className="text-[24px] font-bold tracking-tight">Welcome to your workspace</h2>
                        <p className="text-[15px] text-white/80 leading-relaxed">
                            We've set up a few starter folders for you below. 
                            You can rename, move, or delete them anytime. 
                            Create new <strong>Folders</strong> to organize, and <strong>Whiteboards</strong> to visualize your ideas.
                        </p>
                    </div>
                    <button 
                        onClick={onDismissTour}
                        className="bg-white text-[#3A5C34] px-6 py-3 rounded-full font-semibold text-[14px] shadow-sm hover:bg-[#F2F2F7] transition-all active:scale-95 whitespace-nowrap self-start md:self-center"
                    >
                        Got it, thanks
                    </button>
                </div>
                
                <button 
                    onClick={onDismissTour}
                    className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        )}

        {/* --- HEADER --- */}
        <header className="flex flex-col gap-6 mb-10">
          
          {/* Top Row: Breadcrumbs / Title + Logo */}
          <div className="flex justify-between items-end">
             <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-[13px] font-medium text-gray-400">
                    <span 
                      className="cursor-pointer hover:text-[#3A5C34] transition-colors"
                      onClick={() => onNavigate('root')}
                    >
                      Workspace
                    </span>
                    {breadcrumbs.length > 0 ? (
                      breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={crumb.id || `crumb-${idx}`}>
                          <span className="text-[#FFD753]">/</span>
                          <span 
                            className={`cursor-pointer hover:text-[#3A5C34] transition-colors ${idx === breadcrumbs.length - 1 ? 'text-[#3A5C34]' : ''}`}
                            onClick={() => onNavigate(crumb.id)}
                          >
                            {crumb.name}
                          </span>
                        </React.Fragment>
                      ))
                    ) : (
                      node.id !== 'root' && (
                        <>
                          <span className="text-[#FFD753]">/</span>
                          <span className="text-[#3A5C34]">{node.name}</span>
                        </>
                      )
                    )}
                 </div>
                 
                 <div className="flex items-center gap-3 h-[48px]">
                    {node.icon && <span className="text-[32px]">{node.icon}</span>}
                    
                    {isRenamingHeader ? (
                        <input
                            value={headerName}
                            onChange={(e) => setHeaderName(e.target.value)}
                            onBlur={handleSaveHeaderRenaming}
                            onKeyDown={handleHeaderKeyDown}
                            autoFocus
                            className="text-[32px] font-bold text-[#5F2427] tracking-tight leading-tight bg-transparent border-none outline-none w-full max-w-lg p-0 placeholder-[#5F2427]/30 focus:ring-0"
                        />
                    ) : (
                        // Using Deep Burgundy for the Header to give it weight and warmth
                        <h1 
                            className={`text-[32px] font-bold text-[#5F2427] tracking-tight leading-tight ${!isSpecialView ? 'cursor-text hover:text-[#3A5C34] transition-colors' : ''}`}
                            onDoubleClick={handleStartHeaderRenaming}
                        >
                            {node.name}
                        </h1>
                    )}
                 </div>
             </div>

             {/* Orbit Logo in Top Right Corner - Resized to 40px and aligned to Title baseline */}
             <OrbitLogo className="w-10 h-10 text-[#5F2427] mb-1" />
          </div>

          {/* Controls Row: Search & Actions */}
          <div className="flex items-center justify-between gap-4">
             {/* Search */}
             <div className="relative flex-1 max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#3A5C34] transition-colors" size={16} />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-white border border-gray-200 rounded-xl pl-9 pr-4 text-[14px] text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FCCAE2] focus:border-[#5F2427] transition-all outline-none"
                  placeholder="Filter items..."
                />
             </div>
             
             {/* Actions */}
             <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-50 p-0.5 rounded-xl border border-gray-200 mr-2">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#3A5C34]' : 'text-gray-400 hover:text-[#5F2427]'}`}
                    >
                      <Grid2X2 size={16}/>
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#3A5C34]' : 'text-gray-400 hover:text-[#5F2427]'}`}
                    >
                      <ListIcon size={16}/>
                    </button>
                </div>
                
                {onShare && !isSpecialView && (
                  <button
                    onClick={onShare}
                    title="Share this brand"
                    className="h-9 pl-2 pr-3.5 rounded-xl bg-white border border-gray-200 text-[#5F2427] font-medium text-[13px] hover:bg-gray-50 hover:border-[#3A5C34]/30 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                  >
                    {roster.length > 0 && (
                      <span className="flex items-center -space-x-2">
                        {roster.slice(0, 3).map(m => (
                          m.avatarUrl
                            ? <img key={m.id} src={m.avatarUrl} className="w-6 h-6 rounded-full border-2 border-white object-cover" alt={m.name} />
                            : <span key={m.id} className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white text-[9px] font-bold flex items-center justify-center">{memberInitials(m.name)}</span>
                        ))}
                        {roster.length > 3 && <span className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">+{roster.length - 3}</span>}
                      </span>
                    )}
                    <UserPlus size={14} className="text-[#3A5C34]" /> Share
                  </button>
                )}

                {!isSpecialView && (
                  <>
                    <button
                      onClick={onCreateFolder}
                      className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-[#3A5C34] font-medium text-[13px] hover:bg-gray-50 hover:border-[#3A5C34]/30 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                    >
                      <Folder size={14} className="text-[#FFD753] fill-[#FFD753]" />
                      New Folder
                    </button>
                    
                    <button 
                      onClick={onCreateWhiteboard}
                      // New Chic Combo: Burgundy BG + Pink Text
                      className="h-9 px-4 rounded-xl bg-[#5F2427] text-[#FCCAE2] font-medium text-[13px] hover:bg-[#4a1c1e] transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-[#5F2427]/20"
                    >
                      <Plus size={14} />
                      New Whiteboard
                    </button>
                  </>
                )}
             </div>
          </div>
        </header>

        {/* --- SECTIONS --- */}

        {/* 1. FOLDERS */}
        {(filteredFolders.length > 0 || (!searchQuery && !isSpecialView)) && (
            <section className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-[14px] font-semibold text-[#5F2427]">Folders</h2>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#FCCAE2]/30 text-[11px] font-bold text-[#5F2427]">{filteredFolders.length}</span>
                </div>
                
                {filteredFolders.length > 0 ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-2"}>
                        {filteredFolders.map((folder, idx) =