import type { FileSystemNode } from '../types';
import { sanitizeNodes } from './persistenceDecision';

// Local snapshot ring — the "can't lose a session" net that complements git
// (code history) with data history. On each CONFIRMED save (and on flush) the
// whole tree (JSON only; media lives in Supabase Storage, so this is cheap) is
// pushed into a bounded, deduped localStorage ring per user. A guarded restore
// re-loads a prior tree through the normal gated save path.
//
// The core (`pushSnapshot`) is pure and unit-tested; the localStorage wrappers
// are thin.

export interface Snapshot {
  ts: number;        // epoch ms
  serialized: string; // JSON.stringify of the node tree at that moment
}

export const MAX_SNAPSHOTS = 10;
const keyFor = (uid: string) => `sosa_snap_${uid}`;

/**
 * Pure: next ring given the current ring + a newly-saved serialized tree.
 * - Skips empty/`{}` trees (never snapshot a wipe).
 * - Dedups against the newest entry (no snapshot when nothing changed).
 * - Bounds to the most recent `max`, oldest-first order preserved.
 */
export const pushSnapshot = (ring: Snapshot[], serialized: string, ts: number, max = MAX_SNAPSHOTS): Snapshot[] => {
  if (!serialized || serialized === '{}') return ring;
  if (ring.length > 0 && ring[ring.length - 1].serialized === serialized) return ring;
  const next = [...ring, { ts, serialized }];
  return next.length > max ? next.slice(next.length - max) : next;
};

export const readRing = (uid: string): Snapshot[] => {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(s => s && typeof s.ts === 'number' && typeof s.serialized === 'string') : [];
  } catch { return []; }
};

const writeRing = (uid: string, ring: Snapshot[]) => {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(ring)); } catch { /* quota / private mode */ }
};

/** Record a snapshot for `uid` (no-op on empty/duplicate — pushSnapshot returns
 *  the same ring reference when nothing changed, so we skip the write). */
export const recordSnapshot = (uid: string, serialized: string, ts = Date.now()): void => {
  const ring = readRing(uid);
  const next = pushSnapshot(ring, serialized, ts, MAX_SNAPSHOTS);
  if (next !== ring) writeRing(uid, next);
};

/** Snapshots for `uid`, newest first (for a restore UI). */
export const listSnapshots = (uid: string): Snapshot[] =>
  [...readRing(uid)].sort((a, b) => b.ts - a.ts);

/** Parse+sanitize a snapshot's tree, or null if missing/corrupt. */
export const restoreSnapshot = (uid: string, ts: number): Record<string, FileSystemNode> | null => {
  const snap = readRing(uid).find(s => s.ts === ts);
  if (!snap) return null;
  try {
    const tree = sanitizeNodes(JSON.parse(snap.serialized));
    return Object.keys(tree).length > 0 ? tree : null;
  } catch { return null; }
};
