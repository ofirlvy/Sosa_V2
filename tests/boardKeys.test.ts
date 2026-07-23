import { describe, it, expect } from 'vitest';
import { resolveBoardKey, nudgeCards, KeyContext } from '../services/boardKeys';
import { CardData, CardType } from '../types';

const ctx = (over: Partial<KeyContext> = {}): KeyContext =>
  ({ typing: false, fullscreen: false, selectedCount: 1, expanded: false, ...over });

const card = (id: string, over: Partial<CardData> = {}): CardData =>
  ({ id, type: CardType.POST, x: 100, y: 100, width: 300, height: 200, zIndex: 1, content: {}, ...over } as CardData);

describe('resolveBoardKey — staying out of the way', () => {
  it('ignores EVERYTHING while typing — the board must never steal a keystroke', () => {
    for (const key of ['Delete', 'Backspace', 'Escape', 'Enter', 'ArrowLeft', 'a', 'd']) {
      expect(resolveBoardKey({ key, metaKey: true }, ctx({ typing: true }))).toBeNull();
    }
  });

  it('ignores keys while a card is fullscreen (the card owns them)', () => {
    expect(resolveBoardKey({ key: 'Delete' }, ctx({ fullscreen: true }))).toBeNull();
    expect(resolveBoardKey({ key: 'Enter' }, ctx({ fullscreen: true }))).toBeNull();
  });

  it('never swallows unrelated modifier shortcuts', () => {
    expect(resolveBoardKey({ key: 's', metaKey: true }, ctx())).toBeNull();
    expect(resolveBoardKey({ key: 'z', metaKey: true }, ctx())).toBeNull();
    expect(resolveBoardKey({ key: 'ArrowLeft', metaKey: true }, ctx())).toBeNull();
  });

  it('does nothing destructive with an empty selection', () => {
    const empty = ctx({ selectedCount: 0 });
    expect(resolveBoardKey({ key: 'Delete' }, empty)).toBeNull();
    expect(resolveBoardKey({ key: 'd', metaKey: true }, empty)).toBeNull();
    expect(resolveBoardKey({ key: 'ArrowUp' }, empty)).toBeNull();
  });
});

describe('resolveBoardKey — actions', () => {
  it('Escape peels one layer at a time, never both at once', () => {
    expect(resolveBoardKey({ key: 'Escape' }, ctx({ expanded: true }))).toEqual({ kind: 'collapse' });
    expect(resolveBoardKey({ key: 'Escape' }, ctx({ expanded: false }))).toEqual({ kind: 'deselect' });
  });

  it('Enter opens exactly one selected card, and only when it is not already open', () => {
    expect(resolveBoardKey({ key: 'Enter' }, ctx({ selectedCount: 1 }))).toEqual({ kind: 'open' });
    expect(resolveBoardKey({ key: 'Enter' }, ctx({ selectedCount: 3 }))).toBeNull();
    expect(resolveBoardKey({ key: 'Enter' }, ctx({ selectedCount: 1, expanded: true }))).toBeNull();
  });

  it('arrows nudge by 1px, and by 10px with Shift', () => {
    expect(resolveBoardKey({ key: 'ArrowLeft' }, ctx())).toEqual({ kind: 'nudge', dx: -1, dy: 0 });
    expect(resolveBoardKey({ key: 'ArrowDown', shiftKey: true }, ctx())).toEqual({ kind: 'nudge', dx: 0, dy: 10 });
  });

  it('maps the clipboard family, with Ctrl and Cmd alike', () => {
    expect(resolveBoardKey({ key: 'a', metaKey: true }, ctx())).toEqual({ kind: 'selectAll' });
    expect(resolveBoardKey({ key: 'C', ctrlKey: true }, ctx())).toEqual({ kind: 'copy' });
    expect(resolveBoardKey({ key: 'x', metaKey: true }, ctx())).toEqual({ kind: 'cut' });
    expect(resolveBoardKey({ key: 'd', metaKey: true }, ctx())).toEqual({ kind: 'duplicate' });
  });
});

describe('nudgeCards', () => {
  it('moves only the selected cards', () => {
    const cards = [card('a'), card('b', { x: 0, y: 0 })];
    const out = nudgeCards(cards, ['b'], 10, -10);
    expect(out[0]).toBe(cards[0]);           // untouched card keeps its identity
    expect(out[1]).toMatchObject({ x: 10, y: -10 });
  });

  it('never moves a locked card', () => {
    const cards = [card('a', { isLocked: true })];
    expect(nudgeCards(cards, ['a'], 5, 5)).toBe(cards);
  });

  it('returns the same array when there is nothing to do (no needless re-render/history)', () => {
    const cards = [card('a')];
    expect(nudgeCards(cards, [], 5, 5)).toBe(cards);
    expect(nudgeCards(cards, ['a'], 0, 0)).toBe(cards);
    expect(nudgeCards(cards, ['missing'], 5, 5)).toBe(cards);
  });
});
