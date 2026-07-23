import { FileSystemNode, CalendarEvent, BrandSpace } from '../types';

// Brands (workspaces) — pure scoping logic, unit-tested. One primitive that
// scales from a solo user (one brand, switcher invisible) to a multi-client
// social manager (hard separation per client) to teams (Phase 2).
//
// THE GOLDEN RULE (zero-migration): a node/event WITHOUT `spaceId` belongs to
// the default brand. All pre-brands user data keeps working untouched.

export const DEFAULT_BRAND_ID = 'default';

export const nodeInBrand = (node: FileSystemNode, brandId: string): boolean =>
  (node.spaceId ?? DEFAULT_BRAND_ID) === brandId;

export const eventInBrand = (ev: CalendarEvent, brandId: string): boolean =>
  (ev.spaceId ?? DEFAULT_BRAND_ID) === brandId;

/** The subset of the node map visible inside one brand (read-side only). */
export const filterNodesByBrand = (
  nodes: Record<string, FileSystemNode>,
  brandId: string
): Record<string, FileSystemNode> => {
  const out: Record<string, FileSystemNode> = {};
  for (const [id, n] of Object.entries(nodes)) {
    if (n && nodeInBrand(n, brandId)) out[id] = n;
  }
  return out;
};

/**
 * Coerce a stored brand list into a usable one. Always guarantees the default
 * brand exists (unstamped legacy nodes live there), named after the user's
 * onboarding brand. Empty/invalid → a single default brand.
 */
export const resolveBrands = (
  list: BrandSpace[] | null | undefined,
  fallbackName: string
): BrandSpace[] => {
  const name = (fallbackName || '').trim() || 'My Brand';
  const valid = (Array.isArray(list) ? list : []).filter(
    (b): b is BrandSpace => !!b && typeof b.id === 'string' && !!b.id && typeof b.name === 'string'
  );
  if (!valid.some(b => b.id === DEFAULT_BRAND_ID)) {
    return [{ id: DEFAULT_BRAND_ID, name }, ...valid];
  }
  return valid;
};

/** The active brand id: the stored one if it still exists, else the first. */
export const resolveActiveBrand = (brands: BrandSpace[], storedId: string | null | undefined): string =>
  brands.some(b => b.id === storedId) ? (storedId as string) : (brands[0]?.id || DEFAULT_BRAND_ID);

// Starter folder set for a NEW brand — mirrors useFileSystem's DEFAULT_FOLDERS
// (kept as data here so tests never import the hook / supabase client).
const SEED_FOLDER_TEMPLATE = [
  { key: 'campaigns', name: 'Campaigns', description: 'Launch calendars and seasonal events' },
  { key: 'channels', name: 'Channels', description: 'Social, Email, and Blog content' },
  { key: 'paid', name: 'Paid Media', description: 'Ad creative and performance' },
  { key: 'assets', name: 'Brand Assets', description: 'Guidelines and core assets' },
  { key: 'creative', name: 'Creative Library', description: 'Work in progress' },
  { key: 'reports', name: 'Insights & Reports', description: 'Analytics and research' },
] as const;

/**
 * Fresh default folders for a newly created brand (user-initiated mutation —
 * NOT load-time seeding, so the persistence invariants are untouched). Ids are
 * namespaced by the brand id so they can never collide across brands.
 */
export const seedFoldersForBrand = (brandId: string): Record<string, FileSystemNode> => {
  const out: Record<string, FileSystemNode> = {};
  SEED_FOLDER_TEMPLATE.forEach((t, i) => {
    const id = `folder-${brandId}-${t.key}`;
    out[id] = {
      id,
      type: 'folder',
      name: t.name,
      parentId: null,
      order: i,
      description: t.description,
      spaceId: brandId,
    };
  });
  return out;
};
