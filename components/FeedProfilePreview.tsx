import React from 'react';
import { CardData, CardType, MediaItem, PostCardContent, ReelsCardContent, MockupProfile, MockupHighlight } from '../types';
import { FeedItem, FeedChannel } from '../services/feedPlanner';
import { formatCount, stableCountFromSeed } from '../services/mockupStats';
import { ResolvedMockupProfile, upsertHighlight, removeHighlight } from '../services/mockupProfile';
import { EditProfileSheet } from './mockup/EditProfileSheet';
import { HighlightEditor } from './mockup/HighlightEditor';
import { StoryPreviewModal } from './modals/StoryPreviewModal';
import { newId } from './mockup/mockupUpload';
import {
  Grid3x3, Clapperboard, UserRound, Play, Heart,
  Bookmark, Plus, Camera, Repeat2, Pencil,
} from 'lucide-react';
import { VideoThumb } from './media/VideoThumb';

interface FeedProfilePreviewProps {
  channel: FeedChannel;
  /** Fully resolved identity (stored overrides + brand fallbacks). */
  profile: ResolvedMockupProfile;
  /** Raw stored profile — the edit sheet must seed from overrides, not fallbacks. */
  stored?: MockupProfile;
  /** Omit to render the mockup read-only. */
  onUpdateProfile?: (patch: Partial<MockupProfile>) => void;
  /** Stable seed for the decorative follower counts (the brand, not the edited name). */
  seed?: string;
  items: FeedItem[];
  onOpen: (card: CardData) => void;
  onEdit?: (item: FeedItem) => void;
  /** Drag one tile onto another to swap their dates (reorder the feed). */
  onReorder?: (dragged: FeedItem, target: FeedItem) => void;
}

/**
 * Feed a highlight to the existing Instagram-Stories viewer. StoryPreviewModal
 * only reads `content.frames`, so a minimal synthetic card is enough — this is
 * the one place that shim is allowed to exist.
 */
const highlightAsStoryCard = (h: MockupHighlight): CardData => ({
  id: `highlight-${h.id}`,
  type: CardType.STORY,
  x: 0, y: 0, width: 0, height: 0, zIndex: 0,
  content: { frames: h.frames || [] } as any,
});

const media = (card: CardData): MediaItem | null => {
  if (card.type === CardType.REELS) return (card.content as ReelsCardContent).cover || null;
  const pc = card.content as PostCardContent;
  return pc.finalAssets?.[0] || pc.references?.[0] || null;
};

const Tile: React.FC<{ item: FeedItem; items: FeedItem[]; onOpen: (c: CardData) => void; onEdit?: (i: FeedItem) => void; onReorder?: (dragged: FeedItem, target: FeedItem) => void; aspect: string; views?: string }> = ({ item, items, onOpen, onEdit, onReorder, aspect, views }) => {
  const m = media(item.card);
  const isReel = item.card.type === CardType.REELS;
  const [over, setOver] = React.useState(false);
  const draggable = !!onReorder;
  return (
    <button
      onClick={() => onOpen(item.card)}
      style={{ aspectRatio: aspect }}
      className="relative bg-neutral-100 overflow-hidden group"
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', item.card.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={draggable ? (e) => { e.preventDefault(); if (!over) setOver(true); } : undefined}
      onDragLeave={draggable ? () => setOver(false) : undefined}
      onDrop={draggable ? (e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        const dragged = items.find(i => i.card.id === id);
        if (dragged && dragged.card.id !== item.card.id) onReorder!(dragged, item);
      } : undefined}
    >
      {m?.type === 'image' && <img src={m.url} className="w-full h-full object-cover pointer-events-none" />}
      {m?.type === 'video' && <VideoThumb url={m.url} thumbnail={m.thumbnail} className="w-full h-full object-cover pointer-events-none" />}
      {!m && <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400"><Camera size={18} /></div>}
      {isReel && <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Clapperboard size={14} className="fill-white/20" /></span>}
      {views && (
        <span className="absolute bottom-1 left-1.5 flex items-center gap-0.5 text-white text-[11px] font-semibold drop-shadow">
          <Play size={11} className="fill-white" /> {views}
        </span>
      )}
      <span className={`absolute inset-0 transition-colors ${over ? 'bg-black/25 ring-2 ring-inset ring-white' : 'bg-black/0 group-hover:bg-black/10'}`} />
      {onEdit && (
        <span
          role="button"
          aria-label="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65 z-10"
        >
          <Pencil size={12} />
        </span>
      )}
    </button>
  );
};

// Circular avatar with the Instagram story-ring gradient.
const RingAvatar: React.FC<{ src: string; size: number; ring?: boolean }> = ({ src, size, ring = true }) => (
  <div className="rounded-full p-[2.5px]" style={{ width: size, height: size, background: ring ? 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)' : '#dbdbdb' }}>
    <div className="w-full h-full rounded-full bg-white p-[2px]">
      <img src={src} className="w-full h-full rounded-full object-cover" />
    </div>
  </div>
);

const Stat: React.FC<{ n: string; label: string; center?: boolean }> = ({ n, label, center }) => (
  <div className={center ? 'text-center' : ''}>
    <div className="text-[16px] font-bold text-[#262626] leading-tight">{n}</div>
    <div className="text-[13px] text-[#262626]/80 leading-tight">{label}</div>
  </div>
);

// Shared shape for the two profile skins.
interface ProfileSkinProps {
  profile: ResolvedMockupProfile;
  seed: string;
  items: FeedItem[];
  onOpen: (card: CardData) => void;
  onEdit?: (item: FeedItem) => void;
  onReorder?: (dragged: FeedItem, target: FeedItem) => void;
  editable: boolean;
  onEditProfile: () => void;
  onHighlightTap: (h: MockupHighlight) => void;
  onHighlightEdit: (h: MockupHighlight) => void;
  onHighlightNew: () => void;
}

const InstagramProfile: React.FC<ProfileSkinProps> = ({
  profile, seed, items, onOpen, onEdit, onReorder, editable,
  onEditProfile, onHighlightTap, onHighlightEdit, onHighlightNew,
}) => {
  const { displayName, avatarUrl: avatar, bio, link, highlights } = profile;
  const followers = formatCount(stableCountFromSeed(seed, 4200, 220000, 'followers'));
  const following = formatCount(stableCountFromSeed(seed, 180, 1400, 'following'));
  return (
    <div className="text-[#262626]">
      {/* Header: avatar + stats */}
      <div className="px-4 pt-4 flex items-center gap-6">
        <RingAvatar src={avatar} size={88} />
        <div className="flex-1 flex items-center justify-around">
          <Stat n={String(items.length)} label="posts" center />
          <Stat n={followers} label="followers" center />
          <Stat n={following} label="following" center />
        </div>
      </div>

      {/* Name + bio */}
      <div className="px-4 pt-2.5 text-[13px] leading-[1.35]">
        <div className="font-bold">{displayName}</div>
        {bio && <div className="whitespace-pre-wrap" dir="auto">{bio}</div>}
        {link && <div className="text-[#00376B] font-medium truncate">{link}</div>}
      </div>

      {/* Buttons */}
      <div className="px-4 pt-3 flex gap-1.5">
        <button
          onClick={editable ? onEditProfile : undefined}
          className={`flex-1 h-8 rounded-lg bg-[#EFEFEF] text-[13px] font-semibold ${editable ? 'hover:bg-[#DBDBDB] transition-colors' : ''}`}
        >
          Edit profile
        </button>
        <button className="flex-1 h-8 rounded-lg bg-[#EFEFEF] text-[13px] font-semibold">Share profile</button>
      </div>

      {/* Highlights */}
      <div className="pt-4 pb-1 flex gap-4 px-4 overflow-x-auto no-scrollbar">
        {editable && (
          <button onClick={onHighlightNew} className="flex flex-col items-center gap-1 shrink-0 group">
            <div className="w-[62px] h-[62px] rounded-full border border-[#DBDBDB] flex items-center justify-center bg-neutral-50 text-[#262626] group-hover:bg-neutral-100 transition-colors">
              <Plus size={22} />
            </div>
            <span className="text-[11px] text-[#262626]">New</span>
          </button>
        )}
        {highlights.map(h => (
          <div key={h.id} className="flex flex-col items-center gap-1 shrink-0 group relative">
            <button
              onClick={() => onHighlightTap(h)}
              className="w-[62px] h-[62px] rounded-full border border-[#DBDBDB] overflow-hidden flex items-center justify-center bg-neutral-50 text-neutral-300"
            >
              {h.coverUrl
                ? <img src={h.coverUrl} alt="" className="w-full h-full object-cover" />
                : <Camera size={20} />}
            </button>
            {editable && (
              <button
                onClick={() => onHighlightEdit(h)}
                aria-label={`Edit ${h.title}`}
                className="absolute top-0 right-0 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil size={10} />
              </button>
            )}
            <span className="text-[11px] text-[#262626] max-w-[62px] truncate">{h.title}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-1 grid grid-cols-3 border-t border-[#DBDBDB]">
        <div className="h-11 flex items-center justify-center border-b-2 border-[#262626]"><Grid3x3 size={22} /></div>
        <div className="h-11 flex items-center justify-center text-[#8E8E8E]"><Clapperboard size={22} /></div>
        <div className="h-11 flex items-center justify-center text-[#8E8E8E]"><UserRound size={22} className="border-2 border-current rounded-md p-0.5" /></div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-neutral-300">
          <Camera size={40} strokeWidth={1.2} />
          <p className="text-[13px] font-semibold text-neutral-400 mt-2">No posts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {items.map(it => <Tile key={it.card.id} item={it} items={items} onOpen={onOpen} onEdit={onEdit} onReorder={onReorder} aspect="3 / 4" />)}
        </div>
      )}
    </div>
  );
};

const TikTokProfile: React.FC<ProfileSkinProps> = ({ profile, seed, items, onOpen, onEdit, onReorder, editable, onEditProfile }) => {
  const { username, avatarUrl: avatar, bio, link } = profile;
  const followers = formatCount(stableCountFromSeed(seed, 5000, 500000, 'tt-followers'));
  const following = formatCount(stableCountFromSeed(seed, 40, 900, 'tt-following'));
  const likes = formatCount(stableCountFromSeed(seed, 20000, 3000000, 'tt-likes'));
  return (
    <div className="text-black">
      {/* Centered profile */}
      <div className="flex flex-col items-center pt-4">
        <img src={avatar} className="w-[96px] h-[96px] rounded-full object-cover border border-neutral-200" />
        <div className="text-[17px] font-semibold mt-2">@{username}</div>
        <div className="flex items-center gap-7 mt-3">
          <Stat n={following} label="Following" center />
          <Stat n={followers} label="Followers" center />
          <Stat n={likes} label="Likes" center />
        </div>
        <div className="flex gap-2 mt-3.5 px-6 w-full justify-center">
          <button
            onClick={editable ? onEditProfile : undefined}
            className={`w-[150px] h-9 rounded-md bg-[#EFEFEF] text-[14px] font-semibold ${editable ? 'hover:bg-[#DBDBDB] transition-colors' : ''}`}
          >
            Edit profile
          </button>
          <button className="w-9 h-9 rounded-md bg-[#EFEFEF] flex items-center justify-center"><Bookmark size={16} /></button>
        </div>
        {bio && <p className="text-[13px] text-black/80 mt-3 px-8 text-center whitespace-pre-wrap" dir="auto">{bio}</p>}
        {link && <p className="text-[13px] font-semibold text-black mt-1 px-8 text-center truncate max-w-full">{link}</p>}
      </div>

      {/* Tabs */}
      <div className="mt-3 grid grid-cols-3 border-b border-neutral-200">
        <div className="h-10 flex items-center justify-center border-b-2 border-black"><Grid3x3 size={20} /></div>
        <div className="h-10 flex items-center justify-center text-neutral-400"><Repeat2 size={20} /></div>
        <div className="h-10 flex items-center justify-center text-neutral-400"><Heart size={20} /></div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-neutral-300">
          <Play size={40} strokeWidth={1.2} className="fill-neutral-200" />
          <p className="text-[13px] font-semibold text-neutral-400 mt-2">No videos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {items.map((it, i) => (
            <Tile key={it.card.id} item={it} items={items} onOpen={onOpen} onEdit={onEdit} onReorder={onReorder} aspect="9 / 16"
              views={formatCount(stableCountFromSeed(it.card.id, 800, 900000, `v${i}`))} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FeedProfilePreview: React.FC<FeedProfilePreviewProps> = (props) => {
  const { channel, profile, stored, onUpdateProfile, seed, items, onOpen, onEdit, onReorder } = props;
  const editable = !!onUpdateProfile;

  // Which sheet is open inside the phone, and which highlight is playing.
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [editingHighlight, setEditingHighlight] = React.useState<MockupHighlight | null>(null);
  const [playing, setPlaying] = React.useState<MockupHighlight | null>(null);

  const commitHighlight = (h: MockupHighlight) =>
    onUpdateProfile?.({ highlights: upsertHighlight(profile.highlights, h) });
  const deleteHighlight = (id: string) =>
    onUpdateProfile?.({ highlights: removeHighlight(profile.highlights, id) });

  const skinProps: ProfileSkinProps = {
    profile, seed: seed || profile.displayName, items, onOpen, onEdit, onReorder, editable,
    onEditProfile: () => setEditingProfile(true),
    // Tapping plays the highlight; an empty one goes straight to its editor.
    onHighlightTap: (h) => (h.frames?.length ? setPlaying(h) : editable ? setEditingHighlight(h) : undefined),
    onHighlightEdit: (h) => setEditingHighlight(h),
    onHighlightNew: () => setEditingHighlight({ id: newId('hl'), title: 'New' }),
  };

  return (
    // A flat panel, not a device: the page already frames it like every other
    // surface in the app. Only the profile itself is simulated — no phone shell,
    // no status bar, no app chrome.
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {channel === 'instagram'
          ? <InstagramProfile {...skinProps} />
          : <TikTokProfile {...skinProps} />}
      </div>

      {/* Editors slide over the panel (the parent is `relative`). */}
      {editingProfile && onUpdateProfile && (
        <EditProfileSheet
          profile={profile}
          stored={stored}
          onCommit={onUpdateProfile}
          onClose={() => setEditingProfile(false)}
        />
      )}
      {editingHighlight && onUpdateProfile && (
        <HighlightEditor
          key={editingHighlight.id}
          highlight={editingHighlight}
          onCommit={commitHighlight}
          onDelete={() => deleteHighlight(editingHighlight.id)}
          onClose={() => setEditingHighlight(null)}
        />
      )}

      {playing && (
        <StoryPreviewModal
          story={highlightAsStoryCard(playing)}
          onClose={() => setPlaying(null)}
          brandName={profile.displayName}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
        />
      )}
    </div>
  );
};
