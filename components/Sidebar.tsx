
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
   