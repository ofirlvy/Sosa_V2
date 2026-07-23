import { describe, it, expect } from 'vitest';
import { resolveLoadDecision, sanitizeNodes, resolveOnboardingGate } from '../services/persistenceDecision';
import type { FileSystemNode } from '../types';

// The crown-jewel invariants: these are the exact rules that, when broken once,
// wiped a user's entire workspace. If any of these fail, real data is at risk.

const node = (id: string, name = id): FileSystemNode =>
  ({ id, type: 'folder', name, parentId: null } as FileSystemNode);

const real = { a: node('a'), b: node('b') };
const cache = { c: node('c') };
const defaults = { d: node('d') };

describe('resolveLoadDecision — data-wipe prevention', () => {
  it('ok → sets the loaded tree, enables saving, does NOT re-push to DB', () => {
    const d = resolveLoadDecision({ status: 'ok', nodes: real }, null, defaults, false)!;
    expect(d.nodesToSet).toEqual(real);
    expect(d.saveToDb).toBeNull();
    expect(d.enableSaving).toBe(true);
  });

  it('CRITICAL: error (not exhausted) → null (retry), never a decision that could write', () => {
    expect(resolveLoadDecision({ status: 'error' }, cache, defaults, false)).toBeNull();
    expect(resolveLoadDecision({ status: 'error' }, null, defaults, false)).toBeNull();
  });

  it('CRITICAL: exhausted error NEVER writes to the DB (no seeding defaults over real data)', () => {
    const withCache = resolveLoadDecision({ status: 'error' }, cache, defaults, true)!;
    expect(withCache.saveToDb).toBeNull();
    expect(withCache.nodesToSet).toEqual(cache); // work locally from cache

    const noCache = resolveLoadDecision({ status: 'error' }, null, defaults, true)!;
    expect(noCache.saveToDb).toBeNull();          // <-- the wipe bug would set this to defaults
    expect(noCache.nodesToSet).toEqual(defaults); // defaults shown LOCALLY only
    expect(noCache.writeCacheToo).toBe(false);    // don't leak defaults into the cache
    expect(noCache.markSavedSerialized).toBe(JSON.stringify(defaults)); // marked "already saved"
  });

  it('empty + cache → restore cache AND push it back to the DB', () => {
    const d = resolveLoadDecision({ status: 'empty' }, cache, defaults, false)!;
    expect(d.nodesToSet).toEqual(cache);
    expect(d.saveToDb).toEqual(cache);
  });

  it('empty + no cache → seed defaults AND push them (only genuinely-empty seeds)', () => {
    const d = resolveLoadDecision({ status: 'empty' }, null, defaults, false)!;
    expect(d.nodesToSet).toEqual(defaults);
    expect(d.saveToDb).toEqual(defaults);
  });

  it('ok with junk entries → sanitizes and forces a one-time clean re-save (marker stale)', () => {
    const dirty: any = { a: node('a'), junk: { status: 'ok' }, bad: { type: 'folder' /* no name */ } };
    const d = resolveLoadDecision({ status: 'ok', nodes: dirty }, null, defaults, false)!;
    expect(Object.keys(d.nodesToSet)).toEqual(['a']);
    expect(d.cleaned).toBe(true);
    expect(d.markSavedSerialized).toBe(''); // '' ⇒ dirty ⇒ debounce rewrites the cleaned tree
  });
});

describe('sanitizeNodes', () => {
  it('keeps valid nodes, drops entries missing type or name', () => {
    const raw: any = {
      good: node('good'),
      noType: { name: 'x' },
      noName: { type: 'folder' },
      notObj: 42,
      nul: null,
    };
    expect(Object.keys(sanitizeNodes(raw))).toEqual(['good']);
  });
  it('returns {} for non-objects', () => {
    expect(sanitizeNodes(null)).toEqual({});
    expect(sanitizeNodes('nope' as any)).toEqual({});
  });
});

// The onboarding gate guards EVERY save effect. A transient profile-fetch error
// that lowered it used to break the session AND stop all saving silently — every
// edit after that point was lost on refresh. This pins the rule.
describe('resolveOnboardingGate', () => {
  it('NEVER lowers the gate on a fetch error — the last known value stands', () => {
    expect(resolveOnboardingGate({ status: 'error' }, true)).toBe(true);
    expect(resolveOnboardingGate({ status: 'error' }, false)).toBe(false);
  });
  it('only a successful fetch decides the gate', () => {
    expect(resolveOnboardingGate({ status: 'ok', profile: { onboarding_complete: true } }, false)).toBe(true);
    expect(resolveOnboardingGate({ status: 'ok', profile: { onboarding_complete: false } }, true)).toBe(false);
    expect(resolveOnboardingGate({ status: 'ok', profile: null }, true)).toBe(false); // genuinely new user
  });
});
