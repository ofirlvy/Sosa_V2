import { CardData, CardType, Connector, ZoneCardContent, Position } from '../types';

// In-memory clipboard for whiteboard elements. Copy expands the selection to
// zone children and captures connectors whose BOTH endpoints are copied; paste
// remaps every id (cards, zone childIds, connector endpoints) so pasting can
// never collide with — or mutate — the originals.

export interface CanvasClipboard {
  cards: CardData[];
  connectors: Connector[];
}

/** Marker prefix for the system-clipboard envelope (enables cross-board paste). */
export const CLIPBOARD_ENVELOPE_PREFIX = 'sosa:cards:v1:';

let internalClipboard: CanvasClipboard | null = null;

export const hasInternalClipboard = () => internalClipboard !== null;
export const getInternalClipboard = () => internalClipboard;

/** A media reference extracted from a copied on-board media card. */
export interface CopiedMediaItem { type: 'image' | 'video'; url: string; }

/**
 * Pull the media out of copied ImageCards so it can be pasted INTO a card's slot
 * (References / Final Assets / frames / cover) instead of as a new canvas card.
 * Only IMAGE cards with a usable url; keeps the source's image/video kind.
 */
export const imageCardsToMediaItems = (cards: CardData[]): CopiedMediaItem[] =>
  cards
    .filter(c => c.type === CardType.IMAGE && !!(c.content as any)?.url)
    .map(c => ({ type: (c.content as any).mediaType === 'video' ? 'video' : 'image', url: (c.content as any).url }));

/** True when EVERY copied card is an on-board media (image/video) card. */
export const isAllMediaClipboard = (cards: CardData[]): boolean =>
  cards.length > 0 && cards.every(c => c.type === CardType.IMAGE);

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Selection + zone children of selected zones, as a deep-cloned snapshot. */
export const copySelection = (
  cards: CardData[],
  selectedIds: string[],
  connectors: Connector[] = []
): CanvasClipboard => {
  const ids = new Set(selectedIds);
  cards.forEach(c => {
    if (ids.has(c.id) && c.type === CardType.ZONE) {
      ((c.content as ZoneCardContent).childIds || []).forEach(id => ids.add(id));
    }
  });
  const clip: CanvasClipboard = {
    cards: deepClone(cards.filter(c => ids.has(c.id))),
    connectors: deepClone(connectors.filter(c => ids.has(c.from) && ids.has(c.to))),
  };
  internalClipboard = clip;
  return clip;
};

/** Serialize for the system clipboard (best-effort cross-board paste). */
export const serializeClipboard = (clip: CanvasClipboard): string =>
  CLIPBOARD_ENVELOPE_PREFIX + JSON.stringify(clip);

/** Parse pasted text; returns null unless it's a valid sosa envelope. */
export const parseClipboardText = (text: string): CanvasClipboard | null => {
  if (!text || !text.startsWith(CLIPBOARD_ENVELOPE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(CLIPBOARD_ENVELOPE_PREFIX.length));
    if (!parsed || !Array.isArray(parsed.cards)) return null;
    return { cards: parsed.cards, connectors: Array.isArray(parsed.connectors) ? parsed.connectors : [] };
  } catch {
    return null;
  }
};

const newId = (type: string) => `${type.toLowerCase()}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

export interface Rect { x: number; y: number; width: number; height: number }

const intersects = (a: Rect, b: Rect, gap = 16) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/**
 * Nearest free spot for a rect of `bounds` size, starting from `preferred`
 * (top-left, world coords). Ring-searches outward so pasted content never
 * lands on top of existing cards.
 */
export const findFreeSpot = (
  bounds: { width: number; height: number },
  obstacles: Rect[],
  preferred: Position
): Position => {
  const fits = (x: number, y: number) =>
    !obstacles.some(o => intersects({ x, y, width: bounds.width, height: bounds.height }, o));
  if (fits(preferred.x, preferred.y)) return preferred;
  const STEP = 40;
  for (let ring = 1; ring <= 50; ring++) {
    const d = ring * STEP;
    const candidates: Position[] = [
      { x: preferred.x + d, y: preferred.y },
      { x: preferred.x, y: preferred.y + d },
      { x: preferred.x - d, y: preferred.y },
      { x: preferred.x, y: preferred.y - d },
      { x: preferred.x + d, y: preferred.y + d },
      { x: preferred.x - d, y: preferred.y + d },
      { x: preferred.x + d, y: preferred.y - d },
      { x: preferred.x - d, y: preferred.y - d },
    ];
    for (const c of candidates) if (fits(c.x, c.y)) return c;
  }
  return { x: preferred.x + 40, y: preferred.y + 40 };
};

/**
 * Materialize a clipboard for insertion: fresh ids everywhere (cards, zone
 * childIds, connector endpoints), positions re-based so the group's bounding
 * box lands its top-left at `targetTopLeft`, z-indexes stacked above `maxZ`.
 */
export const materializePaste = (
  clip: CanvasClipboard,
  targetTopLeft: Position,
  maxZ: number
): { cards: CardData[]; connectors: Connector[] } => {
  if (clip.cards.length === 0) return { cards: [], connectors: [] };
  const idMap = new Map<string, string>();
  clip.cards.forEach(c => idMap.set(c.id, newId(c.type)));

  const minX = Math.min(...clip.cards.map(c => c.x));
  const minY = Math.min(...clip.cards.map(c => c.y));
  const offX = targetTopLeft.x - minX;
  const offY = targetTopLeft.y - minY;

  // Preserve relative stacking order within the pasted set.
  const order = [...clip.cards].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const zByCard = new Map<string, number>();
  order.forEach((c, i) => zByCard.set(c.id, maxZ + 1 + i));

  const cards = clip.cards.map(c => {
    const cloned: CardData = deepClone(c);
    cloned.id = idMap.get(c.id)!;
    cloned.x = c.x + offX;
    cloned.y = c.y + offY;
    cloned.zIndex = zByCard.get(c.id);
    if (cloned.type === CardType.ZONE) {
      const zc = cloned.content as ZoneCardContent;
      zc.childIds = (zc.childIds || [])
        .map(id => idMap.get(id))
        .filter(Boolean) as string[];
    }
    return cloned;
  });

  const connectors = clip.connectors
    .map(c => ({ ...deepClone(c), id: `conn-${Date.now()}-${Math.round(Math.random() * 1e6)}`, from: idMap.get(c.from)!, to: idMap.get(c.to)! }))
    .filter(c => c.from && c.to);

  return { cards, connectors };
};

/** Bounding box of a clipboard's cards (for free-spot sizing). */
export const clipboardBounds = (clip: CanvasClipboard): Rect => {
  const minX = Math.min(...clip.cards.map(c => c.x));
  const minY = Math.min(...clip.cards.map(c => c.y));
  const maxX = Math.max(...clip.cards.map(c => c.x + c.width));
  const maxY = Math.max(...clip.cards.map(c => c.y + c.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};
