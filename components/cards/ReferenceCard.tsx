import React, { useState, useRef, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, ReferenceCardContent } from '../../types';
import {
  Plus, Image as ImageIcon, Video, Link as LinkIcon, Play, Pause, Volume2, VolumeX,
  X, UserPlus, Pencil, Send,
  ImagePlay
} from 'lucide-react';
import { persistMedia, isWithinMediaLimit, mediaLimitMessage } from '../../services/fileService';
import { AssigneeStack } from './cardKit';

interface ReferenceCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string, options?: { toggle?: boolean; keepOthers?: boolean }) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
  /** Open the board chat drawer filtered to this card (comment badge). */
  onOpenComments?: (id: string) => void;
}

export const ReferenceCard: React.FC<ReferenceCardProps> = (props) => {
  const { card, onUpdateContent, onResize } = props;
  const content = card.content as ReferenceCardContent;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments live in the board chat drawer; never keep a local copy (clobber risk).

  const [driveInfo, setDriveInfo] = useState({
    synced: !!content?.driveFolderId,
    url: content?.driveFolderUrl || 'https://drive.google.com'
  });

  const [tagInput, setTagInput] = useState('');

  const isCollapsed = !props.isSelected && !!content.mediaUrl;
  const previousIsCollapsed = useRef(isCollapsed);

  // Track aspect ratio
  const [aspectRatio, setAspectRatio] = useState<number>(9/16);

  const handleMediaLoad = (naturalWidth: number, naturalHeight: number) => {
    if (!naturalWidth || !naturalHeight) return;
    setAspectRatio(naturalWidth / naturalHeight);
  };

  const targetHeight = isCollapsed ? (content.expandedSize?.height || 700) : (card.height || 700);
  const nonMediaHeight = 124; 
  const mediaHeight = Math.max(100, targetHeight - nonMediaHeight);

  useEffect(() => {
    if (isCollapsed && !previousIsCollapsed.current) {
      // Transitioning to collapsed
      handleUpdate({ expandedSize: { width: card.width || 800, height: card.height || 700 } });
      
      const mediaWidth = mediaHeight * aspectRatio;
      const collapsedWidth = mediaWidth + 40; // 20px padding on each side
      
      const hasTags = content.vibeTags && content.vibeTags.length > 0;
      const collapsedHeight = 52 + mediaHeight + 36 + (hasTags ? 36 : 0) + 20;
      
      onResize(card.id, { width: collapsedWidth, height: collapsedHeight });
    } else if (!isCollapsed && previousIsCollapsed.current) {
      // Transitioning to expanded
      if (content.expandedSize) {
        onResize(card.id, { width: content.expandedSize.width, height: content.expandedSize.height });
      }
    }
    previousIsCollapsed.current = isCollapsed;
  }, [isCollapsed, card.width, card.height, aspectRatio, content.vibeTags, content.expandedSize, card.id, onResize, mediaHeight]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentContent = {
        ...content,
        driveFolderId: driveInfo.synced ? (content?.driveFolderId || 'mock-id') : undefined,
        driveFolderUrl: driveInfo.url
      };

      if (JSON.stringify(currentContent) !== JSON.stringify(card.content)) {
          onUpdateContent(card.id, currentContent);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [driveInfo, content, card.content, card.id, onUpdateContent]);

  const handleUpdate = (updates: Partial<ReferenceCardContent>) => {
    onUpdateContent(card.id, { ...content, ...updates });
  };

  // Enforce card width based on height and aspect ratio
  useEffect(() => {
    if (isCollapsed) return;

    const mediaWidth = mediaHeight * aspectRatio;
    const rightColumnWidth = 320;

    const gap = 20; // gap-5
    const padding = 40; // px-5 left and right
    const targetWidth = mediaWidth + rightColumnWidth + gap + padding;

    if (Math.abs((card.width || 0) - targetWidth) > 2) {
      onResize(card.id, {
        width: targetWidth,
        height: targetHeight
      });
    }
  }, [card.height, aspectRatio, card.id, onResize, card.width]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isWithinMediaLimit(file)) { alert(mediaLimitMessage()); return; }

    const isVideo = file.type.startsWith('video/');
    const url = await persistMedia(file);

    handleUpdate({
      mediaUrl: url,
      mediaType: isVideo ? 'video' : 'image'
    });
    setIsModalOpen(false);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const isVideo = urlInput.match(/\.(mp4|webm|ogg)$/i) || urlInput.includes('youtube.com') || urlInput.includes('vimeo.com');
    
    handleUpdate({
      mediaUrl: urlInput.trim(),
      mediaType: isVideo ? 'video' : 'url'
    });
    setIsModalOpen(false);
    setUrlInput('');
  };


  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleUpdate({ vibeTags: [...(content.vibeTags || []), tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    const newTags = [...(content.vibeTags || [])];
    newTags.splice(index, 1);
    handleUpdate({ vibeTags: newTags });
  };

  return (
    <BaseCard {...props} title={content.title || 'Reference'} icon={<ImagePlay size={16} className="text-gray-400"/>}>
      <div className="flex flex-col h-full w-full font-sans">
        
        {isCollapsed ? (
          <div className="flex flex-col w-full h-full pointer-events-none select-none animate-in fade-in duration-300">
            {/* Media Container */}
            <div 
              className="w-full relative rounded-xl overflow-hidden bg-black flex items-center justify-center shrink-0" 
              style={{ aspectRatio: aspectRatio }}
            >
              {content.mediaType === 'video' || content.mediaType === 'url' ? (
                <video 
                  src={content.mediaUrl} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src={content.mediaUrl} 
                  alt="Reference" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Title */}
            <h3 className={`mt-4 text-[16px] font-bold leading-tight shrink-0 ${content.title ? 'text-gray-900' : 'text-gray-400'}`}>
              {content.title || 'Untitled Reference'}
            </h3>

            {/* Vibe Tags */}
            {content.vibeTags && content.vibeTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 shrink-0">
                {content.vibeTags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[12px] font-medium text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Main Content Area */}
            <div className="flex flex-1 min-h-0 gap-5">
          
          {/* Left Column: Media Container */}
          {(
            <div className="flex-1 flex flex-col min-w-0 items-center justify-center">
              {!content.mediaUrl ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                  className="w-full h-full rounded-xl border border-dashed flex flex-col items-center justify-center transition-all duration-200 no-drag relative group cursor-pointer bg-gray-50 border-gray-300 hover:border-[#3A5C34] hover:bg-[#FCCAE2]/10"
                >
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-[#3A5C34] group-hover:scale-110 group-active:scale-95 transition-all">
                    <Plus size={14} />
                  </div>
                </button>
              ) : (
                <div 
                  className="w-full relative rounded-xl overflow-hidden bg-black flex items-center justify-center group shrink-0"
                  style={{ aspectRatio: aspectRatio }}
                >
                  {content.mediaType === 'video' || content.mediaType === 'url' ? (
                    <video 
                      src={content.mediaUrl} 
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                      onClick={(e) => e.stopPropagation()}
                      onLoadedMetadata={(e) => handleMediaLoad(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                    />
                  ) : (
                    <img 
                      src={content.mediaUrl} 
                      alt="Reference" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onLoad={(e) => handleMediaLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                    />
                  )}
                  
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Change Media"
                  >
                    <ImageIcon size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Right Column: Details */}
          <div className="w-[320px] shrink-0 flex flex-col min-h-0">

            <div className="flex flex-col gap-4 pb-2">
                {/* Title */}
                <input 
                  className="w-full text-[24px] font-bold text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-300 bg-transparent"
                  value={content.title || ''}
                  onChange={(e) => handleUpdate({ title: e.target.value })}
                  placeholder="Untitled Reference"
                  onClick={(e) => e.stopPropagation()} 
                />

                {/* Source */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Source</label>
                  <input 
                    className="w-full text-[14px] text-gray-700 border-none focus:ring-0 p-0 placeholder-gray-300 bg-transparent"
                    value={content.source || ''}
                    onChange={(e) => handleUpdate({ source: e.target.value })}
                    placeholder="Instagram, TikTok, Pinterest, URL..."
                    onClick={(e) => e.stopPropagation()} 
                  />
                </div>

                {/* Why I love it */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Why I love it</label>
                  <textarea 
                    className="w-full min-h-[96px] text-[14px] text-gray-700 border-none focus:ring-0 p-0 resize-none placeholder-gray-300 bg-transparent overflow-hidden"
                    placeholder="What caught your eye? Lighting, composition, color..."
                    value={content.whyILoveIt || ''}
                    onChange={(e) => handleUpdate({ whyILoveIt: e.target.value })}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                    onClick={(e) => e.stopPropagation()} 
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                {/* What to take */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">What to take</label>
                  <textarea 
                    className="w-full min-h-[96px] text-[14px] text-gray-700 border-none focus:ring-0 p-0 resize-none placeholder-gray-300 bg-transparent overflow-hidden"
                    placeholder="What specific elements to use as reference..."
                    value={content.whatToTake || ''}
                    onChange={(e) => handleUpdate({ whatToTake: e.target.value })}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                    onClick={(e) => e.stopPropagation()} 
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Vibe Tags */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Vibe</label>
                  <div className="flex flex-wrap gap-2">
                    {(content.vibeTags || []).map((tag, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[12px] font-medium text-gray-700">
                        {tag}
                        <button onClick={() => handleRemoveTag(idx)} className="text-gray-400 hover:text-gray-600">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input 
                      type="text" 
                      value={tagInput} 
                      onChange={(e) => setTagInput(e.target.value)} 
                      onKeyDown={handleAddTag} 
                      placeholder="Add tag..." 
                      className="bg-transparent border-none text-[12px] focus:ring-0 p-0 w-24"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Footer — real assignees from the brand roster */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between no-drag shrink-0 mt-auto">
          <AssigneeStack
            assigneeIds={content.assignees || []}
            onChange={(ids) => onUpdateContent(card.id, { ...content, assignees: ids })}
          />
        </div>
        </>
        )}

      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl"
          onClick={(e) => { e.stopPropagation(); setIsModalOpen(false); }}
        >
          <div 
            className="w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Add Reference Media</h3>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${uploadType === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setUploadType('file')}
              >
                Upload File
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${uploadType === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setUploadType('url')}
              >
                Paste URL
              </button>
            </div>

            {uploadType === 'file' ? (
              <div 
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex gap-2 text-gray-400">
                  <ImageIcon size={20} />
                  <Video size={20} />
                </div>
                <span className="text-xs text-gray-500 font-medium">Click to browse files</span>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3">
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-[#3A5C34] focus:ring-1 focus:ring-[#3A5C34] outline-none"
                    autoFocus
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="w-full py-2 bg-[#3A5C34] text-white text-sm font-medium rounded-lg hover:bg-[#2d4a29] disabled:opacity-50 transition-colors"
                >
                  Add Media
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </BaseCard>
  );
};
