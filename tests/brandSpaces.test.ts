import { describe, it, expect } from 'vitest';
import { FileSystemNode, CalendarEvent, BrandSpace } from '../types';
import {
  DEFAULT_BRAND_ID, nodeInBrand, eventInBrand, filterNodesByBrand,
  resolveBrands, resolveActiveBrand, seedFoldersForBrand,
} from '../services/brandSpaces';

// Brands scoping invariants. If these break, either legacy data disappears
// from the default brand (data-loss-feel) or brands leak into each other.

const node = (id: string, spaceId?: string): FileSystemNode =>
  ({ id, type: 'folder', name: id, parentId: null, ...(spaceId ? { spaceId } : {}) } as FileSystemNode);
const event = (id: string, spaceId?: string): CalendarEvent =>
  ({ id, title: id, category: 'launch', startDate: '2026-07-01', ...(spaceId ? { spaceId } : {}) } as CalendarEvent);

describe('nodeInBrand / eventInBrand (the golden rule)', () => {
  it('nodes/events WITHOUT spaceId belong to the default brand only', () => {
    expect(nodeInBrand(node('a'), DEFAULT_BRAND_ID)).toBe(true);
    expect(nodeInBrand(node('a'), 'brand-x')).toBe(false);
    expect(eventInBrand(event('e'), DEFAULT_BRAND_ID)).toBe(true);
    expect(eventInBrand(event('e'), 'brand-x')).toBe(false);
  });
  it('stamped nodes/events belong only to their brand', () => {
    expect(nodeInBrand(node('a', 'brand-x'), 'brand-x')).toBe(true);
    expect(nodeInBrand(node('a', 'brand-x'), DEFAULT_BRAND_ID)).toBe(false);
    expect(eventInBrand(event('e', 'brand-x'), 'brand-x')).toBe(true);
    expect(eventInBrand(event('e', 'brand-x'), DEFAULT_BRAND_ID)).toBe(false);
  });
});

describe('filterNodesByBrand', () => {
  it('splits a mixed map cleanly (no leakage either way)', () => {
    const nodes = { a: node('a'), b: node('b', 'brand-x'), c: node('c', DEFAULT_BRAND_ID) };
    expect(Object.keys(filterNodesByBrand(nodes, DEFAULT_BRAND_ID)).sort()).toEqual(['a', 'c']);
    expect(Object.keys(filterNodesByBrand(nodes, 'brand-x'))).toEqual(['b']);
  });
});

describe('resolveBrands', () => {
  it('empty/null → a single default brand named after the onboarding brand', () => {
    expect(resolveBrands(null, 'Acme Coffee')).toEqual([{ id: DEFAULT_BRAND_ID, name: 'Acme Coffee' }]);
    expect(resolveBrands([], '')).toEqual([{ id: DEFAULT_BRAND_ID, name: 'My Brand' }]);
  });
  it('always guarantees the default brand exists (legacy data lives there)', () => {
    const stored: BrandSpace[] = [{ id: 'brand-x', name: 'Client X' }];
    const resolved = resolveBrands(stored, 'Acme');
    expect(resolved[0]).toEqual({ id: DEFAULT_BRAND_ID, name: 'Acme' });
    expect(resolved).toHaveLength(2);
  });
  it('keeps a valid stored list as-is and drops junk entries', () => {
    const stored = [{ id: DEFAULT_BRAND_ID, name: 'Acme' }, { id: 'b2', name: 'Two' }, { bad: true } as any];
    expect(resolveBrands(stored, 'ignored')).toEqual([
      { id: DEFAULT_BRAND_ID, name: 'Acme' }, { id: 'b2', name: 'Two' },
    ]);
  });
});

describe('resolveActiveBrand', () => {
  const brands: BrandSpace[] = [{ id: DEFAULT_BRAND_ID, name: 'A' }, { id: 'b2', name: 'B' }];
  it('stored id wins when it exists; falls back to the first brand', () => {
    expect(resolveActiveBrand(brands, 'b2')).toBe('b2');
    expect(resolveActiveBrand(brands, 'gone')).toBe(DEFAULT_BRAND_ID);
    expect(resolveActiveBrand(brands, null)).toBe(DEFAULT_BRAND_ID);
  });
});

describe('seedFoldersForBrand', () => {
  it('creates 6 root folders stamped with the brand id, namespaced ids', () => {
    const seeded = seedFoldersForBrand('brand-x');
    const list = Object.values(seeded);
    expect(list).toHaveLength(6);
    expect(list.every(f => f.type === 'folder' && f.parentId === null && f.spaceId === 'brand-x')).toBe(true);
    expect(Object.keys(seeded).every(id => id.includes('brand-x'))).toBe(true);
    // never collides with another brand's seed
    expect(Object.keys(seedFoldersForBrand('brand-y')).some(id => id in seeded)).toBe(false);
  });
});
