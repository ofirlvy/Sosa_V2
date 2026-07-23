
import React, { useState, useRef, useEffect } from 'react';
import { FileSystemNode, NodeType, UserProfile, Brand, BrandSpace } from '../types';
import { soundService } from '../services/soundService';
import { signOut } from '../services/supabase';
import { beginMediaUpload, isWithinMediaLimit, mediaLimitMessage } from '../services/fileService';
import { SettingsModal } from './modals/SettingsModal';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  LayoutTemplate,
  Search,
  Plus,
  MoreHorizontal,
  Star,
  Clock,
  Home,
  Trash2,
  Edit2,
  Volume2,
  VolumeX,
  LogOut,
  User as UserIcon,
  Settings,
  Pencil,
  Calendar,
  LayoutGrid,
  Check,
  Camera,
  Users,
  Eye,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  nodes: Record<string, FileSystemNode>;
  activeNodeId: string;
  userProfile?: UserProfile | null;
  brand?: Brand | null;
  /** Brands (workspaces): the switcher at the top of the sidebar. */
  brandSpaces?: BrandSpace[];
  activeBrandId?: string;
  onSwitchBrand?: (id: string) => void;
  onAddBrand?: (name: string, icon?: string) => void;
  onOpenMembers?: () => void;
  sharedWithMe?: { sharedBrandId: string; name: string; role: string }[];
  onOpenSharedBrand?: (sharedBrandId: string) => void;
  onRenameBrand?: (id: string, name: string) => void;
  onUpdateBrandAvatar?: (id: string, avatarUrl: string) => void;
  onNavigate: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onCreateNode: (type: NodeType, parentId: string | null) => void;
  onToggleFavorite: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string) => void;
  onUpdateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  onDeleteNode: (id: string) => void;
}

const EMOJI_LIST = [
  '📁', '📂', '📄', '📝', '📊', '📈', '🎨', '🖼️', 
  '📅', '🗓️', '🚀', '💡', '🎯', '🔥', '✅', '⚠️', 
  '🔴', '🔵', '🟢', '💼', '🏠', '⭐️', '❤️'
];

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  activeNodeId,
  userProfile,
  brand,
  brandSpaces = [],
  activeBrandId,
  onSwitchBrand,
  onAddBrand,
  onOpenMembers,
  sharedWithMe = [],
  onOpenSharedBrand,
  onRenameBrand,
  onUpdateBrandAvatar,
  onNavigate,
  onToggleExpand,
  onCreateNode,
  onToggleFavorite,
  onMoveNode,
  onUpdateNode,
  onDeleteNode
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // --- Brand switcher state ---
  const [showBrandMenu, setShowBrandMenu] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandValue, setEditBrandValue] = useState("");
  const editBrandInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploadTargetId, setAvatarUploadTargetId] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const activeBrandSpace = brandSpaces.find(b => b.id === activeBrandId) || brandSpaces[0];
  
  // --- Interaction States ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeEmojiId, setActiveEmojiId] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // --- Sound State ---
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = soundService.toggleMute();
    setIsMuted(newState);
  };

  // --- Collapse State (icon-only rail) — persisted across sessions ---
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sosa_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sosa_sidebar_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setActiveEmojiId(null);
      setShowProfileMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (editingBrandId && editBrandInputRef.current) {
      editBrandInputRef.current.focus();
      editBrandInputRef.current.select();
    }
  }, [editingBrandId]);

  // --- Helpers ---
  const getRootNodes = () => (Object.values(nodes) as FileSystemNode[]).filter(n => n.parentId === null);
  const getChildren = (parentId: string) => (Object.values(nodes) as FileSystemNode[]).filter(n => n.parentId === parentId);

  // --- Identity Logic ---
  // Bottom section = the PERSON (profile/settings); the brand switcher at the
  // top is the WORKSPACE identity.
  const displayName = userProfile?.full_name || brand?.name || 'My Workspace';
  const displaySubtitle = userProfile?.account_type === 'team' || brand ? 'Team Plan' : 'Individual';
  const avatarUrl = userProfile?.avatar_url || brand?.logo_url;
  const initials = displayName.substring(0, 2).toUpperCase();

  const brandDisplayName = activeBrandSpace?.name || brand?.name || 'My Brand';
  // Priority: uploaded avatar > (default brand's onboarding logo) > emoji icon > initials.
  const brandAvatarSrc = (b?: BrandSpace): string | undefined =>
    b?.avatarUrl || (b?.id === 'default' ? brand?.logo_url : undefined);

  const submitNewBrand = () => {
    const name = newBrandName.trim();
    if (!name) return;
    onAddBrand?.(name);
    setNewBrandName("");
    setAddingBrand(false);
    setShowBrandMenu(false);
  };

  const startBrandRename = (b: BrandSpace) => {
    setEditingBrandId(b.id);
    setEditBrandValue(b.name);
  };
  const commitBrandRename = () => {
    if (editingBrandId && editBrandValue.trim()) {
      onRenameBrand?.(editingBrandId, editBrandValue.trim());
    }
    setEditingBrandId(null);
  };

  const triggerAvatarUpload = (brandId: string) => {
    setAvatarUploadTargetId(brandId);
    avatarFileInputRef.current?.click();
  };
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetId = avatarUploadTargetId;
    setAvatarUploadTargetId(null);
    if (!file || !targetId) return;
    if (!isWithinMediaLimit(file)) { alert(mediaLimitMessage()); return; }
    // Optimistic: instant local preview, then swap in the persisted Storage URL.
    const { previewUrl, promise } = beginMediaUpload(file);
    onUpdateBrandAvatar?.(targetId, previewUrl);
    promise.then(finalUrl => onUpdateBrandAvatar?.(targetId, finalUrl)).catch(() => { /* keep the preview */ });
  };

  // --- Actions ---
  const startRenaming = (e: React.MouseEvent, node: FileSystemNode) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingId(node.id);
    setEditValue(node.name);
  };

  const finishRenaming = () => {
    if (editingId && editValue.trim()) {
      onUpdateNode(editingId, { name: editValue.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') finishRenaming();
    if (e.key === 'Escape') setEditingId(null);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
    setActiveEmojiId(null);
  };

  const toggleEmojiPicker = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveEmojiId(activeEmojiId === id ? null : id);
    setActiveMenuId(null);
  };

  const selectEmoji = (id: string, emoji: string) => {
    onUpdateNode(id, { icon: emoji });
    setActiveEmojiId(null);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (editingId) {
      e.preventDefault();
      return;
    }
    setDraggedNodeId(id);
    e.dataTransfer.setData('nodeId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetNode: FileSystemNode) => {
    e.preventDefault();
    if (targetNode.type !== 'whiteboard') {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('nodeId');
    if (dragId && dragId !== targetId) {
      onMoveNode(dragId, targetId);
      soundService.play('drop'); // Sound Feedback
    }
    setDraggedNodeId(null);
  };

  // --- Recursive Tree Item ---
  const TreeItem: React.FC<{ nodeId: string; depth?: number }> = ({ nodeId, depth = 0 }) => {
    const node = nodes[nodeId];
    if (!node) return null;

    if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        const children = getChildren(nodeId);
        const hasMatchingChild = children.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!hasMatchingChild) return null;
    }

    const children = getChildren(nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = node.isExpanded || searchTerm.length > 0;
    const isActive = activeNodeId === nodeId;
    const isEditing = editingId === nodeId;

    const getIcon = () => {
      if (node.icon) return <span className="text-[14px] leading-none">{node.icon}</span>;
      if (node.type === 'folder' || node.type === 'page') return <Folder size={14} className={isActive ? "text-[#3A5C34]" : "text-[#5F2427]/70"} fill={isActive ? "currentColor" : "none"} />;
      return <LayoutTemplate size={14} className={isActive ? "text-[#3A5C34]" : "text-[#5F2427]/70"} />;
    };

    return (
      <div className="select-none relative">
        <div 
          className={`
            group flex items-center gap-2 py-1.5 px-2 mx-2 rounded-lg cursor-pointer text-[13px] transition-all relative
            ${isActive ? 'bg-[#3A5C34]/10 text-[#3A5C34] font-medium' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}
            ${draggedNodeId === nodeId ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => !isEditing && onNavigate(nodeId)}
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, nodeId)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, nodeId)}
        >
          {/* Chevron */}
          <div 
            className={`w-4 h-4 flex items-center justify-center rounded hover:bg-[#5F2427]/10 text-[#5F2427]/60 transition-colors ${!hasChildren && node.type === 'whiteboard' ? 'opacity-0' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleExpand(nodeId); }}
          >
            {(hasChildren || node.type !== 'whiteboard') && (
               isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            )}
          </div>

          {/* Icon (Click to Change) */}
          <div 
            className="shrink-0 cursor-pointer hover:scale-110 transition-transform"
            onClick={(e) => toggleEmojiPicker(e, nodeId)}
          >
            {getIcon()}
          </div>

          {/* Name (Double Click to Rename) */}
          {isEditing ? (
            <input 
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishRenaming}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-transparent border-none p-0 text-[13px] text-[#5F2427] outline-none h-5 min-w-0 focus:ring-0 font-inherit"
            />
          ) : (
            <span 
                className="truncate flex-1"
                onDoubleClick={(e) => startRenaming(e, node)}
            >
                {node.name}
            </span>
          )}

          {/* Quick Actions (Hover) */}
          <div className={`flex items-center gap-1 ${activeMenuId === nodeId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
             {node.type !== 'whiteboard' && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onCreateNode('folder', nodeId); }} 
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F9E6D1] text-[#5F2427]/60 hover:text-[#5F2427]"
                    title="New Sub-folder"
                >
                    <Plus size={12} />
                </button>
             )}
             <button 
                onClick={(e) => toggleMenu(e, nodeId)}
                className={`w-5 h-5 flex items-center justify-center rounded hover:bg-[#F9E6D1] transition-colors ${activeMenuId === nodeId ? 'text-[#5F2427] bg-[#F9E6D1]' : 'text-[#5F2427]/60 hover:text-[#5F2427]'}`}
             >
                <MoreHorizontal size={12} />
             </button>
          </div>
        </div>

        {/* --- EMOJI POPUP --- */}
        {activeEmojiId === nodeId && (
            <div 
                className="absolute left-full top-0 ml-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 grid grid-cols-5 gap-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
            >
                {EMOJI_LIST.map(emoji => (
                    <button 
                        key={emoji} 
                        onClick={() => selectEmoji(nodeId, emoji)}
                        className="w-8 h-8 flex items-center justify-center text-[16px] hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {emoji}
                    </button>
                ))}
                {/* Reset Option */}
                <button 
                    onClick={() => selectEmoji(nodeId, '')}
                    className="col-span-5 text-[10px] text-gray-400 hover:text-red-500 py-1 font-medium mt-1 border-t border-gray-100"
                >
                    Reset Icon
                </button>
            </div>
        )}

        {/* --- CONTEXT MENU --- */}
        {activeMenuId === nodeId && (
            <div 
                className="absolute right-2 top-8 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-32 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={(e) => startRenaming(e, node)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 text-left"
                >
                    <Edit2 size={12} /> Rename
                </button>
                <button 
                    onClick={() => { onDeleteNode(nodeId); setActiveMenuId(null); }}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 text-left"
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        )}

        {/* Render Children */}
        {isExpanded && (
          <div>
            {children.map((child, idx) => (
              <TreeItem key={child.id || `child-${idx}`} nodeId={child.id} depth={depth + 1} />
            ))}
            
            {/* Empty Folder State in Tree */}
            {children.length === 0 && (node.type === 'folder' || node.type === 'page') && (
                 <div className="px-2 mx-2 py-1 text-[12px] text-[#5F2427]/50 italic select-none" style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}>
                    Empty
                 </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    collapsed ? (
      /* --- COLLAPSED ICON RAIL --- */
      <div className="w-[64px] h-full bg-[#ffd753] flex flex-col items-center flex-shrink-0 font-sans transition-[width] duration-300">
        <div className="pt-4 pb-2">
          <button onClick={toggleCollapsed} title="Expand sidebar" className="w-10 h-10 flex items-center justify-center rounded-xl text-[#5F2427] hover:bg-[#F9E6D1]/60 transition-colors">
            <PanelLeftOpen size={18} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-1 mt-2">
          {([
            { id: 'root', Icon: Home, label: 'Home' },
            { id: 'calendar', Icon: Calendar, label: 'Calendar' },
            { id: 'planner', Icon: LayoutGrid, label: 'Feed' },
            { id: 'recents', Icon: Clock, label: 'Recents' },
            { id: 'favorites', Icon: Star, label: 'Favorites' },
          ] as const).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeNodeId === id ? 'bg-[#3A5C34]/15 text-[#3A5C34]' : 'text-[#5F2427]/70 hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1 pb-4">
          <button onClick={handleToggleSound} title={isMuted ? 'Unmute' : 'Mute'} className={`w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#F9E6D1]/60 transition-colors ${isMuted ? 'text-[#5F2427]/60' : 'text-[#3A5C34]'}`}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowProfileMenu(false); toggleCollapsed(); }} title="Expand" className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white flex items-center justify-center text-[12px] font-bold shadow-sm overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <span>{initials}</span>}
          </button>
        </div>
      </div>
    ) : (
    <div className="w-[280px] h-full bg-[#ffd753] flex flex-col flex-shrink-0 font-sans transition-[width] duration-300">

      {/* --- BRAND SWITCHER (own section: pink compact bar + burgundy curtain, mirrors the bottom profile section) --- */}
      {brandSpaces.length > 0 && (
      <div className="bg-[#5F2427] relative z-20">
        {/* Hidden file input shared by every brand row's avatar-upload */}
        <input ref={avatarFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />

        {/* The pink bar — collapsed-by-default compact identity row */}
        <div className="bg-[#FCCAE2] relative z-30">
          {/* Outer padding + inner rounded pill: the SAME hover treatment as the
              user row at the bottom of the sidebar (a floating peach highlight),
              not a full-bleed tint that also washes over the avatar. */}
          <div className="px-2 py-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setShowBrandMenu(v => !v); setAddingBrand(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') setShowBrandMenu(v => !v); }}
            className="w-full flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer hover:bg-[#F9E6D1]/60 border border-transparent transition-all group"
          >
            {/* A real logo gets a plain light surface — the green gradient exists
                for white initials, and behind a dark transparent PNG it reads as
                a murky layer over the picture. */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold overflow-hidden shrink-0 ${brandAvatarSrc(activeBrandSpace) ? 'bg-white' : 'bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white shadow-sm'}`}>
              {brandAvatarSrc(activeBrandSpace) ? <img src={brandAvatarSrc(activeBrandSpace)} alt="Brand" className="w-full h-full object-cover" />
                : activeBrandSpace?.icon ? <span className="text-[16px]">{activeBrandSpace.icon}</span>
                : <span>{brandDisplayName.substring(0, 2).toUpperCase()}</span>}
            </div>
            <div className="flex-1 text-left min-w-0">
              {editingBrandId === activeBrandSpace?.id ? (
                <input
                  ref={editBrandInputRef}
                  value={editBrandValue}
                  onChange={(e) => setEditBrandValue(e.target.value)}
                  onBlur={commitBrandRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitBrandRename(); if (e.key === 'Escape') setEditingBrandId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-[14px] font-bold text-[#5F2427] bg-white/50 rounded px-1 -mx-1 outline-none border border-[#5F2427]/30 focus:border-[#5F2427]"
                />
              ) : (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => { e.stopPropagation(); if (activeBrandSpace) startBrandRename(activeBrandSpace); }}
                  className="text-[14px] font-bold text-[#5F2427] leading-tight truncate"
                >
                  {brandDisplayName}
                </div>
              )}
            </div>
            <ChevronDown size={14} className={`text-[#5F2427]/60 group-hover:text-[#5F2427] shrink-0 transition-transform ${showBrandMenu ? 'rotate-180' : ''}`} />
          </div>
          </div>

          {/* The green repeating gradient — same divider used at the bottom of the sidebar */}
          <div className="px-[14px] shrink-0 transition-all duration-300 pb-0">
            <div className="h-3 w-full bg-[repeating-linear-gradient(to_right,#3A5C34,#3A5C34_2px,transparent_2px,transparent_16px)]"></div>
          </div>
        </div>

        {/* The Curtain — brand list + Add brand, burgundy bg (inherits from the wrapper) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showBrandMenu ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-3 space-y-1 max-h-[340px] overflow-y-auto no-scrollbar">
            {brandSpaces.map(b => (
              <div key={b.id} className="group/row flex items-center rounded-xl hover:bg-[#F9E6D1]/10 transition-colors">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { setShowBrandMenu(false); if (b.id !== activeBrandId) onSwitchBrand?.(b.id); }}
                  className="flex-1 flex items-center gap-2.5 p-2 min-w-0 text-left cursor-pointer"
                >
                  <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden group/avatar ${brandAvatarSrc(b) ? 'bg-white' : 'bg-[#F9E6D1]/10 text-[#F9E6D1]'}`}>
                    {brandAvatarSrc(b) ? <img src={brandAvatarSrc(b)} className="w-full h-full object-cover" />
                      : b.icon ? <span className="text-[14px]">{b.icon}</span>
                      : <span>{b.name.substring(0, 2).toUpperCase()}</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); triggerAvatarUpload(b.id); }}
                      title="Change picture"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover/avatar:opacity-100 group-hover/avatar:bg-black/50 text-white transition-all"
                    >
                      <Camera size={12} />
                    </button>
                  </div>
                  {editingBrandId === b.id ? (
                    <input
                      ref={editBrandInputRef}
                      value={editBrandValue}
                      onChange={(e) => setEditBrandValue(e.target.value)}
                      onBlur={commitBrandRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitBrandRename(); if (e.key === 'Escape') setEditingBrandId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-[13px] font-semibold text-[#F9E6D1] bg-white/10 rounded px-1 -mx-1 outline-none border border-[#F9E6D1]/30 focus:border-[#F9E6D1]"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); startBrandRename(b); }}
                      className="flex-1 text-[13px] font-semibold text-[#F9E6D1] truncate"
                    >
                      {b.name}
                    </span>
                  )}
                  {b.id === activeBrandId && <Check size={14} className="text-[#F9E6D1] shrink-0" />}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startBrandRename(b); }}
                  title="Rename brand"
                  className="w-7 h-7 mr-1 rounded-lg flex items-center justify-center text-[#F9E6D1]/50 opacity-0 group-hover/row:opacity-100 hover:text-[#F9E6D1] hover:bg-[#F9E6D1]/10 transition-all shrink-0"
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 pb-3">
            {addingBrand ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitNewBrand(); if (e.key === 'Escape') setAddingBrand(false); }}
                  placeholder="Brand or client name…"
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-white/10 border border-[#F9E6D1]/30 text-[13px] text-[#F9E6D1] placeholder-[#F9E6D1]/40 focus:ring-0 focus:border-[#F9E6D1] outline-none"
                />
                <button onClick={submitNewBrand} className="h-8 px-3 rounded-lg bg-[#FFD753] text-[#5F2427] text-[12px] font-bold hover:bg-[#ffcf2e] transition-colors shrink-0">Add</button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setAddingBrand(true); }}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F9E6D1]/10 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-lg border border-dashed border-[#F9E6D1]/40 text-[#F9E6D1]/60 flex items-center justify-center shrink-0"><Plus size={13} /></div>
                <span className="text-[13px] font-semibold text-[#F9E6D1]/80">Add brand</span>
              </button>
            )}
            {onOpenMembers && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowBrandMenu(false); onOpenMembers(); }}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F9E6D1]/10 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#F9E6D1]/10 text-[#F9E6D1]/70 flex items-center justify-center shrink-0"><Users size={13} /></div>
                <span className="text-[13px] font-semibold text-[#F9E6D1]/80">Members &amp; sharing</span>
              </button>
            )}
            {sharedWithMe.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-[#F9E6D1]/10">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#F9E6D1]/40">Shared with me</div>
                {sharedWithMe.map(s => (
                  <button
                    key={s.sharedBrandId}
                    onClick={(e) => { e.stopPropagation(); setShowBrandMenu(false); onOpenSharedBrand?.(s.sharedBrandId); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F9E6D1]/10 text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F9E6D1]/10 text-[#F9E6D1]/70 flex items-center justify-center shrink-0"><Eye size={13} /></div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#F9E6D1]/90 truncate">{s.name}</span>
                      <span className="block text-[10px] text-[#F9E6D1]/40 capitalize">{s.role} · view only</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* --- SEARCH --- */}
      <div className="px-3 pt-4 mb-6">
         <div className="relative group">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F2427]/60 group-focus-within:text-[#3A5C34] transition-colors" />
            <input 
              className="w-full bg-white border border-[#F9E6D1] rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-[#5F2427] focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none transition-all placeholder-[#5F2427]/50"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* --- QUICK LINKS --- */}
      <div className="px-2 mb-6">
          <button 
             onClick={() => onNavigate('root')} 
             className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${activeNodeId === 'root' ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
          >
              <Home size={16} className={activeNodeId === 'root' ? 'text-[#3A5C34]' : 'text-[#5F2427]/70'} />
              Home
          </button>
          <button 
             onClick={() => onNavigate('calendar')} 
             className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${activeNodeId === 'calendar' ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
          >
              <Calendar size={16} className={activeNodeId === 'calendar' ? 'text-[#3A5C34]' : 'text-[#5F2427]/70'} />
              Calendar
          </button>
          <button
             onClick={() => onNavigate('planner')}
             className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${activeNodeId === 'planner' ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
          >
              <LayoutGrid size={16} className={activeNodeId === 'planner' ? 'text-[#3A5C34]' : 'text-[#5F2427]/70'} />
              Feed
          </button>
          <button 
             onClick={() => onNavigate('recents')}
             className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${activeNodeId === 'recents' ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
          >
              <Clock size={16} className={activeNodeId === 'recents' ? 'text-[#3A5C34]' : 'text-[#5F2427]/70'} />
              Recents
          </button>
          <button 
             onClick={() => onNavigate('favorites')}
             className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${activeNodeId === 'favorites' ? 'bg-[#3A5C34]/10 text-[#3A5C34]' : 'text-[#5F2427] hover:bg-[#F9E6D1]/60 hover:text-[#5F2427]'}`}
          >
              <Star size={16} className={activeNodeId === 'favorites' ? 'text-[#FCCAE2] fill-[#FCCAE2]' : 'text-[#5F2427]/70'} />
              Favorites
          </button>
      </div>

      {/* --- FOLDER TREE --- */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
         
         <div className="px-4 mb-2 flex items-center justify-between">
             <span className="text-[11px] font-bold text-[#5F2427]/60 uppercase tracking-wider">Folders</span>
             <button 
                onClick={() => onCreateNode('folder', null)}
                className="p-1 rounded hover:bg-[#F9E6D1] text-[#5F2427]/60 hover:text-[#5F2427] transition-colors"
             >
                 <Plus size={12} />
             </button>
         </div>

         <div className="space-y-0.5">
            {getRootNodes().map((node, idx) => (
                <TreeItem key={node.id || `root-${idx}`} nodeId={node.id} />
            ))}
         </div>
         
         {getRootNodes().length === 0 && (
             <div className="px-4 py-4 text-center text-[12px] text-[#5F2427]/50">
                 No folders yet
             </div>
         )}
      </div>

      {/* --- BOTTOM SECTION (PROFILE & CURTAIN) --- */}
      <div className="mt-auto flex flex-col bg-[#5F2427] relative z-20">
         {/* The yellow bar that sits on top of the curtain */}
         <div className="bg-[#ffd753] relative z-30">
           <div className="p-3 flex gap-2">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
                className="flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-[#F9E6D1]/60 border border-transparent transition-all group"
             >
                 <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white flex items-center justify-center text-[12px] font-bold shadow-sm overflow-hidden">
                     {avatarUrl ? (
                         <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                     ) : (
                         <span>{initials}</span>
                     )}
                 </div>
                 <div className="flex-1 text-left min-w-0">
                     <div className="text-[13px] font-semibold text-[#5F2427] leading-none truncate">{displayName}</div>
                     <div className="text-[11px] text-[#5F2427]/70 mt-0.5 truncate">{displaySubtitle}</div>
                 </div>
                 {showProfileMenu ? (
                     <ChevronUp size={14} className="text-[#5F2427]/60 group-hover:text-[#5F2427] shrink-0" />
                 ) : (
                     <ChevronDown size={14} className="text-[#5F2427]/60 group-hover:text-[#5F2427] shrink-0" />
                 )}
             </button>
             
             {/* Sound Toggle */}
             <button
                onClick={handleToggleSound}
                className={`w-9 flex items-center justify-center transition-all rounded-xl hover:bg-[#F9E6D1]/60 ${isMuted ? 'text-[#5F2427]/60 hover:text-[#5F2427]' : 'text-[#3A5C34] hover:text-[#2d4a29]'}`}
                title={isMuted ? "Unmute Sounds" : "Mute Sounds"}
             >
                 {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
             </button>

             {/* Collapse sidebar to icon rail */}
             <button
                onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }}
                className="w-9 flex items-center justify-center transition-all rounded-xl hover:bg-[#F9E6D1]/60 text-[#5F2427]/60 hover:text-[#5F2427]"
                title="Collapse sidebar"
             >
                 <PanelLeftClose size={16} />
             </button>
           </div>
           
           {/* --- BOTTOM DECORATIVE GRADIENT --- */}
           <div className="px-[14px] shrink-0 transition-all duration-300 pb-0">
             <div className="h-3 w-full bg-[repeating-linear-gradient(to_right,#3A5C34,#3A5C34_2px,transparent_2px,transparent_16px)]"></div>
           </div>
         </div>

         {/* The Curtain Content */}
         <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${showProfileMenu ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
         >
             <div className="flex flex-col items-center p-4">
                 <div className="relative mb-3">
                     <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3A5C34] to-[#2d4a29] text-white flex items-center justify-center text-2xl font-bold shadow-sm overflow-hidden">
                         {avatarUrl ? (
                             <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                         ) : (
                             <span>{initials}</span>
                         )}
                     </div>
                     <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-[#F9E6D1] rounded-full shadow-md border border-[#5F2427] flex items-center justify-center text-[#5F2427] hover:bg-white transition-colors">
                         <Pencil size={12} />
                     </button>
                 </div>
                 <div className="text-[14px] font-semibold text-[#F9E6D1]">{displayName}</div>
                 <div className="text-[12px] text-[#F9E6D1]/70 mb-4">{userProfile?.email || 'No email'}</div>
                 
                 <div className="w-full space-y-1">
                     <button 
                        onClick={() => {
                            setShowProfileMenu(false);
                            setIsSettingsOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-[#F9E6D1] hover:bg-[#F9E6D1]/10 rounded-xl transition-colors text-left font-medium"
                     >
                         <Settings size={16} className="text-[#F9E6D1]/70" /> Settings
                     </button>
                     <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-[#F9E6D1] hover:bg-[#F9E6D1]/10 rounded-xl transition-colors text-left font-medium"
                     >
                         <LogOut size={16} className="text-[#F9E6D1]/70" /> Sign Out
                     </button>
                 </div>
             </div>
         </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
      />
    </div>
    )
  );
};
