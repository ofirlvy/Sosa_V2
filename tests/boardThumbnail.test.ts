import { describe, it, expect } from 'vitest';
import { computeThumbFrame, mediaUrlFor, cardAssets, pickImageBudget, pickWorkspace, thumbCards } from '../services/boardThumbnail';
import { CardData, CardType, Workspace } from '../types';

// The board thumbnail is how a user recognises a board among many, so the two
// things that matter are: it shows ALL the content (not a random corner), and it
// finds each card's real image.

const card = (over: Partial<CardData> & { id: string }): CardData => ({
  type: CardType.POST, x: 0, y: 0, width: 300, height: 200, zIndex: 1, content: {}, ...over,
} as CardData);

describe('computeThumbFrame', () => {
  it('fits ALL cards — a far-flung card is never cropped out', () => {
    const cards = [card({ id: 'a' }), card({ id: 'far', x: 4000, y: 3000 })];
    const f = computeThumbFrame(cards)!;
    expect(f.x).toBeLessThanOrEqual(0);
    expect(f.y).toBeLessThanOrEqual(0);
    expect(f.x + f.w).toBeGreaterThanOrEqual(4300);
    expect(f.y + f.h).toBeGreaterThanOrEqual(3200);
  });

  it('letterboxes to 4:3 without shifting the content off-centre', () => {
    // A tall arrangement must gain width on BOTH sides, keeping the centre.
    const cards = [card({ id: 'a', x: 0, y: 0, width: 100, height: 1000 })];
    const f = computeThumbFrame(cards)!;
    expect(f.w / f.h).toBeCloseTo(4 / 3, 5);
    expect(f.x + f.w / 2).toBeCloseTo(50, 5);   // same centre x
    expect(f.y + f.h / 2).toBeCloseTo(500, 5);  // same centre y
  });

  it('pads so cards do not touch the frame edge', () => {
    const f = computeThumbFrame([card({ id: 'a', x: 0, y: 0, width: 400, height: 300 })])!;
    expect(f.x).toBeLessThan(0);
    expect(f.y).toBeLessThan(0);
  });

  it('returns null for no cards (callers keep the empty-board thumbnail)', () => {
    expect(computeThumbFrame([])).toBeNull();
  });
});

describe('mediaUrlFor / cardAssets', () => {
  it('prefers a stored poster over the raw url — a video url paints nothing', () => {
    const c = card({ id: 'v', type: CardType.IMAGE, content: { url: 'x.mp4', thumbnail: 'p.jpg', mediaType: 'video' } as any });
    expect(mediaUrlFor(c)).toBe('p.jpg');
  });

  it('reads each card type from the right place', () => {
    expect(mediaUrlFor(card({ id: 'p', type: CardType.POST, content: { references: [{ id: '1', type: 'image', url: 'r.png' }] } as any }))).toBe('r.png');
    // final assets win over references
    expect(mediaUrlFor(card({
      id: 'p2', type: CardType.POST,
      content: { references: [{ id: '1', type: 'image', url: 'r.png' }], finalAssets: [{ id: '2', type: 'image', url: 'f.png' }] } as any,
    }))).toBe('f.png');
    expect(mediaUrlFor(card({ id: 'r', type: CardType.REELS, content: { cover: { id: 'c', type: 'video', url: 'c.mp4', thumbnail: 'c.jpg' } } as any }))).toBe('c.jpg');
    expect(mediaUrlFor(card({ id: 's', type: CardType.STORY, content: { frames: [{ id: 'f', type: 'image', url: 's.png' }] } as any }))).toBe('s.png');
    expect(mediaUrlFor(card({ id: 'l', type: CardType.LINK, content: { url: 'https://x', imageUrl: 'og.png' } as any }))).toBe('og.png');
  });

  it('ignores assets with no usable url, and returns none for text-ish cards', () => {
    expect(cardAssets(card({ id: 'p', type: CardType.POST, content: { references: [{ id: '1', type: 'image' }] } as any }))).toEqual([]);
    expect(mediaUrlFor(card({ id: 't', type: CardType.TEXT, content: { text: 'hi' } as any }))).toBeUndefined();
    expect(mediaUrlFor(card({ id: 'z', type: CardType.ZONE, content: {} as any }))).toBeUndefined();
  });
});

describe('pickImageBudget', () => {
  const withImg = (id: string, w: number, h: number) =>
    card({ id, type: CardType.IMAGE, width: w, height: h, content: { url: `${id}.png` } as any });

  it('caps the number of images and keeps the largest cards', () => {
    const cards = [withImg('small', 10, 10), withImg('big', 900, 900), withImg('mid', 300, 300)];
    const budget = pickImageBudget(cards, 2);
    expect(budget.size).toBe(2);
    expect(budget.has('big')).toBe(true);
    expect(budget.has('mid')).toBe(true);
    expect(budget.has('small')).toBe(false);
  });

  it('never counts cards that have no image at all', () => {
    const cards = [withImg('a', 100, 100), card({ id: 'text', type: CardType.TEXT, content: { text: 'x' } as any })];
    expect(pickImageBudget(cards, 14)).toEqual(new Set(['a']));
  });
});

describe('workspace selection', () => {
  it('picks the busiest tab and drops strokes / degenerate cards', () => {
    const ws: Workspace[] = [
      { id: 'a', name: 'A', cards: [card({ id: '1' })] } as any,
      { id: 'b', name: 'B', cards: [card({ id: '2' }), card({ id: '3' }), card({ id: 's', type: CardType.STROKE }), card({ id: 'zero', width: 0 })] } as any,
    ];
    const picked = pickWorkspace(ws)!;
    expect(picked.id).toBe('b');
    expect(thumbCards(picked).map(c => c.id)).toEqual(['2', '3']);
  });
});
