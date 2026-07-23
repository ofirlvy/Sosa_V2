// Believable, stable placeholder stats for the profile mockup (followers,
// following, likes). Deterministic from the brand name so numbers don't flicker
// between renders. Pure — unit-tested.

/** Compact social count: 812 → "812", 12800 → "12.8K", 2_400_000 → "2.4M". */
export const formatCount = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k < 100 ? k.toFixed(1) : Math.round(k).toString()).replace(/\.0$/, '') + 'K';
  }
  const m = n / 1_000_000;
  return (m < 100 ? m.toFixed(1) : Math.round(m).toString()).replace(/\.0$/, '') + 'M';
};

// Small deterministic string hash (djb2-ish) → unsigned 32-bit.
const hashSeed = (seed: string): number => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h >>> 0;
};

/**
 * A stable pseudo-count in [min, max] derived from `seed` (+ optional salt so a
 * single brand can have distinct followers/following/likes values).
 */
export const stableCountFromSeed = (seed: string, min: number, max: number, salt = ''): number => {
  const h = hashSeed(seed + '|' + salt);
  const span = Math.max(1, max - min);
  return min + (h % span);
};
