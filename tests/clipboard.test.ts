import { describe, it, expect } from 'vitest';
import { CardData, CardType, Connector, ZoneCardContent } from '../types';
import {
  materializePaste, serializeClipboard, parseClipboardText, CanvasClipboard,
} from '../services/clipboardService';

// Paste must remap EVERY id (cards, zone childIds, connector endpoints) and share
// no references with the source — otherwise a pasted zone points at the original's
// children (the latent duplicate-zone bug) or ids collide and corrupt the board.

const zone = (id: string, childIds: string[]): CardData => ({
  id, type: CardType.ZONE, x: 0, y: 0, width: 400, height: 300, zIndex: 1,
  content: { title: 'G', color: '#FCCAE2', childIds } as ZoneCardContent,
});
const card = (id: string, x = 10, y = 10): CardData => ({
  id, type: CardType.TEXT, x, y, width: 100, height: 50, zIndex: 2,
  content: { text: id } as any,
});
const conn = (id: string, from: string, to: string): Connector => ({ id, from, to } as Connector);

const clip: CanvasClipboard = {
  cards: [zone('z1', ['c1', 'c2']), card('c1', 20, 20), card('c2', 140, 20)],
  connectors: [conn('k1', 'c1', 'c2')],
};

describe('materializePaste — full id remap, no shared refs', () => {
  const out = materializePaste(clip, { x: 500, y: 500 }, 100);

  it('assigns fresh ids to every card', () => {
    const ids = out.cards.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(['z1', 'c1', 'c2']).not.toContain(id);
  });

  it('rewrites zone childIds to the new card ids (no dangling to originals)', () => {
    const z = out.cards.find(c => c.type === CardType.ZONE)!;
    const childIds = (z.content as ZoneCardContent).childIds!;
    const liveIds = new Set(out.cards.map(c => c.id));
    expect(childIds.length).toBe(2);
    for (const cid of childIds) {
      expect(liveIds.has(cid)).toBe(true);
      expect(['c1', 'c2']).not.toContain(cid);
    }
  });

  it('remaps connector endpoints to the new ids', () => {
    const liveIds = new Set(out.cards.map(c => c.id));
    expect(out.connectors.length).toBe(1);
    expect(liveIds.has(out.connectors[0].from)).toBe(true);
    expect(liveIds.has(out.connectors[0].to)).toBe(true);
  });

  it('does not mutate or share references with the source clipboard', () => {
    expect(clip.cards[0].id).toBe('z1'); // source untouched
    expect((clip.cards[0].content as ZoneCardContent).childIds).toEqual(['c1', 'c2']);
    for (const c of out.cards) expect(clip.cards).not.toContain(c);
  });

  it('rebases positions so the group top-left lands at the target', () => {
    const minX = Math.min(...out.cards.map(c => c.x));
    const minY = Math.min(...out.cards.map(c => c.y));
    expect(minX).toBe(500);
    expect(minY).toBe(500);
  });
});

describe('clipboard envelope round-trip', () => {
  it('serialize → parse yields an equivalent clipboard', () => {
    const text = serializeClipboard(clip);
    const parsed = parseClipboardText(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.cards.map(c => c.id)).toEqual(['z1', 'c1', 'c2']);
    expect(parsed!.connectors).toHaveLength(1);
  });

  it('rejects non-envelope text (so pasting normal text is not misparsed)', () => {
    expect(parseClipboardText('just some pasted text')).toBeNull();
    expect(parseClipboardText('')).toBeNull();
    expect(parseClipboardText('https://example.com')).toBeNull();
  });
});
