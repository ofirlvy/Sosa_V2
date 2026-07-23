import { describe, it, expect } from 'vitest';
import { formatCount, stableCountFromSeed } from '../services/mockupStats';

describe('formatCount', () => {
  it('formats hundreds / thousands / millions', () => {
    expect(formatCount(812)).toBe('812');
    expect(formatCount(1200)).toBe('1.2K');
    expect(formatCount(12800)).toBe('12.8K');
    expect(formatCount(128000)).toBe('128K');
    expect(formatCount(2_400_000)).toBe('2.4M');
    expect(formatCount(1000)).toBe('1K');
  });
});

describe('stableCountFromSeed', () => {
  it('is deterministic and within [min,max)', () => {
    const a = stableCountFromSeed('Acme', 1000, 50000, 'followers');
    const b = stableCountFromSeed('Acme', 1000, 50000, 'followers');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1000);
    expect(a).toBeLessThan(50000);
  });
  it('salt varies the value; different seeds differ', () => {
    expect(stableCountFromSeed('Acme', 0, 1e6, 'followers')).not.toBe(stableCountFromSeed('Acme', 0, 1e6, 'following'));
    expect(stableCountFromSeed('Acme', 0, 1e6)).not.toBe(stableCountFromSeed('Zeta', 0, 1e6));
  });
});
