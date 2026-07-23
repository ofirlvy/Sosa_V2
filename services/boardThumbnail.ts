import { CardData, CardType, Workspace, PostCardContent, ReelsCardContent, StoryCardContent, ImageCardContent, LinkCardContent, MediaItem } from '../types';

// Pure logic behind the board thumbnail (components/BoardThumbnail.tsx).
// Read-only: nothing here ever writes to a card or a node.

/** The workspace (tab) a thumbnail should represent: the busiest one. */
export const pickWorkspace = (workspaces?: Workspace[]): Workspace | undefined =>
  (workspaces || []).slice().sort((a, b) => (b.cards?.length || 0) - (a.cards?.length || 0))[0];

/** Cards worth drawing (freehand strokes are noise at thumbnail scale). */
export const thumbCards = (ws?: Workspace): CardData[] =>
  (ws?.cards || []).filter(c => c && c.type !== CardType.STROKE && c.width > 0 && c.height > 0);

export interface ThumbFrame { x: number; y: number; w: number; h: number; }

/**
 * The viewBox for the thumbnail: fit ALL the content (like Figma's "zoom to
 * fit"), pad it, then letterbox to the card's aspect ratio.
 *
 * The previous implementation cropped to the densest 800px grid cell, which is
 * why a board full of work showed two or three shapes from an arbitrary corner.
 */
export const computeThumbFrame = (cards: CardData[], aspect = 4 / 3, padRatio = 0.06): ThumbFrame | null => {
  if (!cards.length) return null;

  const minX = Math.min(...cards.map(c => c.x));
  const minY = Math.min(...cards.map(c => c.y));
  const maxX = Math.max(...cards.map(c => c.x + c.width));
  const maxY = Math.max(...cards.map(c => c.y + c.height));

  const pad = Math.max(maxX - minX, maxY - minY) * padRatio;
  let x = minX - pad, y = minY - pad;
  let w = (maxX - minX) + pad * 2;
  let h = (maxY - minY) + pad * 2;

  // Letterbox on the short side so the content stays centred and unstretched.
  if (w / h > aspect) {
    const nh = w / aspect;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    x -= (nw - w) / 2;
    w = nw;
  }
  return { x, y, w, h };
};

const firstAsset = (items?: MediaItem[]): MediaItem | undefined =>
  (items || []).find(i => i && (i.thumbnail || i.url));

/** Prefer a stored poster over the asset itself — video urls paint nothing. */
export const assetUrl = (item?: MediaItem): string | undefined =>
  item ? (item.thumbnail || item.url || undefined) : undefined;

/** Every drawable asset of a card, in display order (posts show a grid of them). */
export const cardAssets = (card: CardData): MediaItem[] => {
  const content: any = card.content || {};
  switch (card.type) {
    case CardType.POST: {
      const c = content as PostCardContent;
      const list = (c.finalAssets?.length ? c.finalAssets : c.references) || [];
      return list.filter(i => i && (i.thumbnail || i.url));
    }
    case CardType.STORY:
      return ((content as StoryCardContent).frames || []).filter(i => i && (i.thumbnail || i.url));
    case CardType.REELS: {
      const cover = (content as ReelsCardContent).cover;
      return cover && (cover.thumbnail || cover.url) ? [cover] : [];
    }
    case CardType.IMAGE: {
      const c = content as ImageCardContent;
      const url = c.thumbnail || c.url;
      return url ? [{ id: card.id, type: c.mediaType === 'video' ? 'video' : 'image', url }] : [];
    }
    case CardType.LINK: {
      const url = (content as LinkCardContent).imageUrl;
      return url ? [{ id: card.id, type: 'image', url }] : [];
    }
    default:
      return [];
  }
};

/** The single best image representing a card (undefined when it has none). */
export const mediaUrlFor = (card: CardData): string | undefined => assetUrl(firstAsset(cardAssets(card)));

/**
 * Which cards may load real images. The Home page renders a thumbnail per board,
 * so an unbounded version would pull dozens of full-size images on one screen.
 * The biggest cards carry the most recognition per byte.
 */
export const pickImageBudget = (cards: CardData[], max = 14): Set<string> => {
  const withMedia = cards.filter(c => cardAssets(c).length > 0);
  const ranked = withMedia
    .slice()
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))
    .slice(0, max);
  return new Set(ranked.map(c => c.id));
};
