import type { FileSystemNode } from '../types';
import type { LoadNodesResult } from './supabase';

// Pure decision logic for "what to do with a load result" — extracted from
// useFileSystem so the data-wipe-prevention rules are unit-testable without a
// DOM. This is the exact seam where a full data wipe happened once (an 'error'
// load was mistaken for 'empty' and seeded DEFAULT_FOLDERS OVER real data), so
// its invariants are pinned by tests in tests/persistenceDecision.test.ts.
//
// Type-only import of LoadNodesResult ⇒ no runtime dependency on supabase.ts
// (createClient) when this module is imported by tests.

type Nodes = Record<string, FileSystemNode>;

/**
 * The onboarding gate is part of the persistence contract: it gates EVERY save
 * effect (useFileSystem / useCalendarEvents / useBrandSpaces). A failed profile
 * fetch must therefore NEVER lower it — doing so both showed the onboarding
 * screen mid-session and silently stopped all saving, so every edit made
 * afterwards was lost on refresh. Only a SUCCESSFUL fetch may change it.
 */
export const resolveOnboardingGate = (
  res: { status: 'ok'; profile: { onboarding_complete?: boolean } | null } | { status: 'error' },
  current: boolean
): boolean => (res.status === 'ok' ? res.profile?.onboarding_complete === true : current);

/** Keep only valid file-system nodes (object with string `type` AND `name`). */
export const sanitizeNodes = (raw: any): Nodes => {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Nodes = {};
  for (const [id, v] of Object.entries(raw)) {
    if (v && typeof v === 'object' && typeof (v as any).type === 'string' && typeof (v as any).name === 'string') {
      clean[id] = v as FileSystemNode;
    }
  }
  return clean;
};

export interface LoadDecision {
  /** Tree to put into React state / latestNodesRef. */
  nodesToSet: Nodes;
  /** Tree to push to the DB, or null to NOT write (never write defaults on error). */
  saveToDb: Nodes | null;
  /** Whether to mark the load complete (enables future debounced saves). */
  enableSaving: boolean;
  /** Value to store in lastSavedSerializedRef ('' = intentionally dirty → re-save). */
  markSavedSerialized: string;
  /** True when sanitize removed junk (forces a one-time clean re-save). */
  cleaned: boolean;
  /** Whether to mirror nodesToSet into the localStorage cache. */
  writeCacheToo: boolean;
}

// The common "settle" outcome: sanitize the tree, set it, enable saving, cache it.
const settle = (tree: Nodes, saveToDb: Nodes | null): LoadDecision => {
  const clean = sanitizeNodes(tree);
  const cleaned = Object.keys(clean).length !== Object.keys(tree || {}).length;
  return {
    nodesToSet: clean,
    saveToDb,
    enableSaving: true,
    // If sanitize removed junk, leave the marker stale ('') so the next debounced
    // save rewrites the cleaned tree back to the DB (one-time repair).
    markSavedSerialized: cleaned ? '' : JSON.stringify(clean),
    cleaned,
    writeCacheToo: true,
  };
};

/**
 * Decide what to do with a resolved load.
 * @returns a LoadDecision, or `null` meaning "retry" (only for a non-exhausted error).
 *
 * INVARIANT: an 'error' result NEVER returns `saveToDb` (never writes to the DB) —
 * a transient failure must not overwrite real data with defaults.
 */
export const resolveLoadDecision = (
  result: LoadNodesResult,
  cache: Nodes | null,
  defaults: Nodes,
  exhaustedRetries: boolean,
): LoadDecision | null => {
  if (result.status === 'ok') {
    // Real data from the DB. Set it (sanitized); no re-write except the cleaned repair.
    return settle(result.nodes, null);
  }

  if (result.status === 'empty') {
    // DB genuinely has nothing. Prefer a local cache (offline edits / DB was wiped),
    // else seed defaults; push whichever we chose so the DB is populated.
    if (cache) return settle(cache, cache);
    return settle(defaults, defaults);
  }

  // result.status === 'error' — transient (session not hydrated / network).
  if (!exhaustedRetries) return null; // signal: retry with backoff

  // Persistent failure. Work locally; NEVER push to the DB (it may hold real,
  // currently-unreadable data — writing defaults would be the wipe bug).
  if (cache) return settle(cache, null);
  return {
    nodesToSet: defaults,
    saveToDb: null,
    enableSaving: true,
    markSavedSerialized: JSON.stringify(defaults), // marked "already saved" → no push until user edits
    cleaned: false,
    writeCacheToo: false, // don't leak defaults into the cache (could mask a later good DB load)
  };
};
