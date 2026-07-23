import { describe, it, expect } from 'vitest';
import { resolveMockupProfile, sanitizeUsername, upsertHighlight, removeHighlight } from '../services/mockupProfile';
import type { MockupHighlight } from '../types';

// The mockup profile is edited by hand but must render sensibly for a brand
// that never opened the editor — so the fallback chain is the contract.

describe('resolveMockupProfile', () => {
  const fallback = { brandName: 'Sunset Coffee', avatarUrl: 'https://x/brand.png' };

  it('falls back to the brand identity when nothing is set', () => {
    const r = resolveMockupProfile(undefined, fallback);
    expect(r.displayName).toBe('Sunset Coffee');
    expect(r.username).toBe('sunset_coffee');
    expect(r.avatarUrl).toBe('https://x/brand.png');
    expect(r.bio).toBe('');
    expect(r.highlights).toEqual([]);
  });

  it('prefers stored values over the brand', () => {
    const r = resolveMockupProfile(
      { username: '@SunsetCo', displayName: 'Sunset Co.', avatarUrl: 'https://x/own.png', bio: 'Beans', link: 'sunset.co' },
      fallback,
    );
    expect(r.username).toBe('sunsetco');
    expect(r.displayName).toBe('Sunset Co.');
    expect(r.avatarUrl).toBe('https://x/own.png');
    expect(r.bio).toBe('Beans');
    expect(r.link).toBe('sunset.co');
  });

  // Clearing a field in the edit sheet must restore the brand default, not
  // render an empty profile — so blank/whitespace counts as "not set".
  it('treats blank and whitespace-only fields as unset', () => {
    const r = resolveMockupProfile({ username: '   ', displayName: '', avatarUrl: '  ' }, fallback);
    expect(r.username).toBe('sunset_coffee');
    expect(r.displayName).toBe('Sunset Coffee');
    expect(r.avatarUrl).toBe('https://x/brand.png');
  });

  it('generates an avatar only when the brand has none', () => {
    const r = resolveMockupProfile(undefined, { brandName: 'Sunset Coffee' });
    expect(r.avatarUrl).toContain('ui-avatars.com');
    expect(r.avatarUrl).toContain('Sunset%20Coffee');
  });

  it('never yields an empty username, even with no brand at all', () => {
    const r = resolveMockupProfile(undefined, {});
    expect(r.username).toBe('your_brand');
    expect(r.displayName).toBe('Your brand');
  });
});

describe('sanitizeUsername', () => {
  it('strips @, collapses whitespace to _, lowercases', () => {
    expect(sanitizeUsername('  @Sunset Coffee Co ')).toBe('sunset_coffee_co');
    expect(sanitizeUsername('@@double')).toBe('double');
  });
});

describe('highlight helpers', () => {
  const a: MockupHighlight = { id: 'a', title: 'BTS' };
  const b: MockupHighlight = { id: 'b', title: 'Press' };

  it('upsert adds a new one and replaces by id without duplicating', () => {
    expect(upsertHighlight([a], b)).toEqual([a, b]);
    const edited = upsertHighlight([a, b], { id: 'a', title: 'Behind the scenes' });
    expect(edited).toHaveLength(2);
    expect(edited[0].title).toBe('Behind the scenes');
    expect(edited[1]).toEqual(b);
  });

  it('remove drops only the target and does not mutate the input', () => {
    const list = [a, b];
    expect(removeHighlight(list, 'a')).toEqual([b]);
    expect(list).toHaveLength(2);
  });
});
