import { CardData } from '../types';

// Pure keyboard logic for the board. Kept out of Canvas so the rules that decide
// "what does this keypress mean" are testable without a DOM.

export type BoardAction =
  | { kind: 'delete' }
  | { kind: 'selectAll' }
  | { kind: 'copy' }
  | { kind: 'cut' }
  | { kind: 'duplicate' }
  /** Open the selected card's editor. */
  | { kind: 'open' }
  /** Layered: close an open editor first, only then clear the selection. */
  | { kind: 'collapse' }
  | { kind: 'deselect' }
  | { kind: 'nudge'; dx: number; dy: number }
  | null;

export interface KeyContext {
  /** True while focus is in a text field — the board must stay out of the way. */
  typing: boolean;
  /** A card is open fullscreen; it owns its own keys. */
  fullscreen: boolean;
  selectedCount: number;
  /** A card is currently expanded into its editor. */
  expanded: boolean;
}

export interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

const NUDGE = 1;
const NUDGE_FAST = 10; // with Shift, like every design tool

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * What a keypress means on the board. Returns null when the board should ignore
 * it (typing, fullscreen, or nothing selected to act on).
 */
export const resolveBoardKey = (e: KeyEventLike, ctx: KeyContext): BoardAction => {
  if (ctx.typing || ctx.fullscreen) return null;
  const mod = !!(e.metaKey || e.ctrlKey);
  const has = ctx.selectedCount > 0;

  if (mod) {
    const k = e.key.toLowerCase();
    if (k === 'a') return { kind: 'selectAll' };
    if (k === 'c') return has ? { kind: 'copy' } : null;
    if (k === 'x') return has ? { kind: 'cut' } : null;
    if (k === 'd') return has ? { kind: 'duplicate' } : null;
    return null; // never swallow other browser/system shortcuts
  }

  if (e.key === 'Delete' || e.key === 'Backspace') return has ? { kind: 'delete' } : null;

  // Escape peels one layer at a time: close the editor, keep the card selected;
  // press again to deselect. Jumping straight to "nothing selected" loses your place.
  if (e.key === 'Escape') return ctx.expanded ? { kind: 'collapse' } : { kind: 'deselect' };

  // Enter opens exactly one selected card (ambiguous for a multi-selection).
  if (e.key === 'Enter') return ctx.selectedCount === 1 && !ctx.expanded ? { kind: 'open' } : null;

  const arrow = ARROWS[e.key];
  if (arrow && has) {
    const step = e.shiftKey ? NUDGE_FAST : NUDGE;
    return { kind: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step };
  }
  return null;
};

/** Move the selected cards by a delta. Returns the same array when nothing matched. */
export const nudgeCards = (cards: CardData[], ids: string[], dx: number, dy: number): CardData[] => {
  if (!ids.length || (dx === 0 && dy === 0)) return cards;
  const set = new Set(ids);
  let changed = false;
  const next = cards.map(c => {
    if (!set.has(c.id) || c.isLocked) return c; // locked cards never move
    changed = true;
    return { ...c, x: c.x + dx, y: c.y + dy };
  });
  return changed ? next : cards;
};
