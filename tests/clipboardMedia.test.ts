import { describe, it, expect } from 'vitest';
import { CardData, CardType } from '../types';
import { imageCardsToMediaItems, isAllMediaClipboard } from '../services/clipboardService';

// Paste an on-board media object into a card slot: only IMAGE cards with a url
// become media items, keeping image/video kind.
const img = (id: string, url: string, mediaType?: 'image' | 'video'): CardData => ({
  id, type: CardType.IMAGE, x: 0, y: 0, width: 100, height: 100, zIndex: 1,
  content: { url, mediaType } as any,
});
const post = (id: string): CardData => ({
  id, type: CardType.POST, x: 0, y: 0, width: 100, height: 100, zIndex: 1, content: {} as any,
});

describe('imageCardsToMediaItems', () => {
  it('extracts image/video media, skips non-image and url-less cards', () => {
    const cards = [img('a', 'u1'), img('b', 'u2', 'video'), img('c', ''), post('d')];
    expect(imageCardsToMediaItems(cards)).toEqual([
      { type: 'image', url: 'u1' },
      { type: 'video', url: 'u2' },
    ]);
  });
});

describe('isAllMediaClipboard', () => {
  it('true only when every card is an image card', () => {
    expect(isAllMediaClipboard([img('a', 'u1'), img('b', 'u2')])).toBe(true);
    expect(isAllMediaClipboard([img('a', 'u1'), post('d')])).toBe(false);
    expect(isAllMediaClipboard([])).toBe(false);
  });
});
