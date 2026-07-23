import { useState, useEffect, useRef } from 'react';
import { BrandSpace, MockupProfile, FeedCadence, FeedDraft, BrandMember } from '../types';
import { loadBrandSpaces, saveBrandSpaces } from '../services/supabase';
import { resolveBrands, resolveActiveBrand, DEFAULT_BRAND_ID } from '../services/brandSpaces';

/**
 * Owns the user's Brand (workspace) list + the active brand. Persistence has
 * the same safety shape as useCalendarEvents: load once per user, discriminated
 * load (never clobber on error), gated + debounced save, localStorage cache,
 * flush-on-close. The list is always resolved (default brand guaranteed), so a
 * solo user simply lives in the default brand and never notices this layer.
 * The active brand id is a device preference → localStorage only.
 */
const cacheKeyFor = (uid: string) => `sosa_brands_${uid}`;
const activeKeyFor = (uid: string) => `sosa_active_brand_${uid}`;

const readCache = (uid: string): BrandSpace[] | null => {
  try {
    const raw = localStorage.getItem(cacheKeyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};
const writeCache = (uid: string, brands: BrandSpace[]) => {
  try { localStorage.setItem(cacheKeyFor(uid), JSON.stringify(brands)); } catch { /* quota */ }
};

interface UseBrandSpacesArgs {
  session: any;
  onboardingComplete: boolean;
  /** Name for the default brand (from the onboarding `brands` row). */
  fallbackName: string;
}

export function useBrandSpaces({ session, onboardingComplete, fallbackName }: UseBrandSpacesArgs) {
  const [brands, setBrands] = useState<BrandSpace[]>([{ id: DEFAULT_BRAND_ID, name: fallbackName || 'My Brand' }]);
  const [activeBrandId, setActiveBrandId] = useState<string>(DEFAULT_BRAND_ID);
  const [brandsLoaded, setBrandsLoaded] = useState(false);

  const loadedUserIdRef = useRef<string | null>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const latestRef = useRef<BrandSpace[]>([]);
  latestRef.current = brands;

  const userId: string | undefined = session?.user?.id;

  useEffect(() => {
    if (!userId) { loadedUserIdRef.current = null; setBrandsLoaded(false); }
  }, [userId]);

  // Load once per user.
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current === userId) return;
    let cancelled = false;

    const cached = readCache(userId);
    if (cached) {
      const resolved = resolveBrands(cached, fallbackName);
      setBrands(resolved);
      setActiveBrandId(resolveActiveBrand(resolved, localStorage.getItem(activeKeyFor(userId))));
      setBrandsLoaded(true);
    }

    const settle = (list: BrandSpace[] | null) => {
      if (cancelled) return;
      const resolved = resolveBrands(list, fallbackName);
      setBrands(resolved);
      setActiveBrandId(resolveActiveBrand(resolved, localStorage.getItem(activeKeyFor(userId))));
      setBrandsLoaded(true);
      lastSavedSerializedRef.current = JSON.stringify(resolved);
      latestRef.current = resolved;
      loadedUserIdRef.current = userId; // enables saving for this user
      writeCache(userId, resolved);
    };

    const attempt = async (tries: number) => {
      if (cancelled) return;
      const res = await loadBrandSpaces();
      if (cancelled) return;
      if (res.status === 'ok') { settle(res.brands); return; }
      if (res.status === 'empty') { settle(cached); return; }
      // error → retry; never overwrite a possibly-real list on transient failure.
      if (tries < 4) { setTimeout(() => attempt(tries + 1), 500 * 2 ** tries); return; }
      settle(cached); // persistent failure: cache or a fresh default — both safe
    };

    attempt(0);
    return () => { cancelled = true; };
  }, [userId, onboardingComplete, fallbackName]);

  // The onboarding brand name can resolve AFTER the list settled — upgrade the
  // default brand's placeholder name once (never fights a user rename).
  useEffect(() => {
    if (!brandsLoaded) return;
    const name = (fallbackName || '').trim();
    if (!name || name === 'My Brand') return;
    setBrands(prev => prev.map(b =>
      b.id === DEFAULT_BRAND_ID && b.name === 'My Brand' ? { ...b, name } : b
    ));
  }, [fallbackName, brandsLoaded]);

  // Debounced save (gated on a completed load; skips unchanged).
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current !== userId) return;
    const serialized = JSON.stringify(brands);
    if (serialized === lastSavedSerializedRef.current) return;
    const timer = setTimeout(async () => {
      writeCache(userId, brands);
      const ok = await saveBrandSpaces(brands);
      if (ok) lastSavedSerializedRef.current = serialized;
    }, 800);
    return () => clearTimeout(timer);
  }, [brands, userId, onboardingComplete]);

  // Flush on tab hide/close.
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (loadedUserIdRef.current !== userId) return;
      const serialized = JSON.stringify(latestRef.current);
      if (serialized === lastSavedSerializedRef.current) return;
      writeCache(userId, latestRef.current);
      saveBrandSpaces(latestRef.current);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [userId]);

  const switchBrand = (id: string) => {
    if (!brands.some(b => b.id === id)) return;
    setActiveBrandId(id);
    if (userId) { try { localStorage.setItem(activeKeyFor(userId), id); } catch { /* quota */ } }
  };

  const addBrand = (name: string, icon?: string): string => {
    const id = `brand-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    const brand: BrandSpace = { id, name: name.trim() || 'New Brand', icon, createdAt: new Date().toISOString() };
    setBrands(prev => [...prev, brand]);
    setActiveBrandId(id);
    if (userId) { try { localStorage.setItem(activeKeyFor(userId), id); } catch { /* quota */ } }
    return id;
  };

  const renameBrand = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBrands(prev => prev.map(b => b.id === id ? { ...b, name: trimmed } : b));
  };

  const updateBrandAvatar = (id: string, avatarUrl: string) => {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, avatarUrl } : b));
  };

  /**
   * Patch one channel's mockup social profile. MERGES — a partial write (e.g.
   * only the avatar, from an optimistic upload that resolves later) must never
   * drop the other fields. Same rule as `onUpdateCard` in App.tsx; blind
   * replacement here is how CLAUDE.md §6 mistake #14 erased live data.
   */
  const updateBrandProfile = (id: string, channel: string, patch: Partial<MockupProfile>) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, socialProfiles: { ...b.socialProfiles, [channel]: { ...b.socialProfiles?.[channel], ...patch } } }
      : b));
  };

  /**
   * Set the feed cadence for one (channel, month). Deep-merges so a write to
   * (IG, July) never drops (IG, August) or (TikTok, July) — same anti-clobber
   * rule as updateBrandProfile. Auto-persisted by the debounced save below.
   */
  const updateBrandFeedCadence = (id: string, channel: string, monthKey: string, cadence: FeedCadence) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, feedCadence: { ...b.feedCadence, [channel]: { ...b.feedCadence?.[channel], [monthKey]: cadence } } }
      : b));
  };

  // --- Feed drafts (saved monthly plans per channel+month) -------------------
  // Same anti-clobber discipline as above: only ever touch b.feedDrafts, never
  // replace the brand. Persistence rides the debounced save.
  const addBrandDraft = (id: string, draft: FeedDraft) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, feedDrafts: [...(b.feedDrafts || []), draft] }
      : b));
  };
  const updateBrandDraft = (id: string, draftId: string, patch: Partial<FeedDraft>) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, feedDrafts: (b.feedDrafts || []).map(d => d.id === draftId ? { ...d, ...patch } : d) }
      : b));
  };
  const removeBrandDraft = (id: string, draftId: string) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, feedDrafts: (b.feedDrafts || []).filter(d => d.id !== draftId) }
      : b));
  };

  // --- Brand members (the people layer; access is per-brand) -----------------
  // Same anti-clobber discipline: only ever touch b.members. The OWNER is never
  // stored here — it's derived from the account (see services/brandMembers).
  const addBrandMember = (id: string, member: BrandMember) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, members: [...(b.members || []), member] }
      : b));
  };
  const updateBrandMember = (id: string, memberId: string, patch: Partial<BrandMember>) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, members: (b.members || []).map(m => m.id === memberId ? { ...m, ...patch } : m) }
      : b));
  };
  const removeBrandMember = (id: string, memberId: string) => {
    setBrands(prev => prev.map(b => b.id === id
      ? { ...b, members: (b.members || []).filter(m => m.id !== memberId) }
      : b));
  };

  const activeBrand = brands.find(b => b.id === activeBrandId) || brands[0];

  return { brands, activeBrandId, activeBrand, brandsLoaded, addBrand, renameBrand, updateBrandAvatar, updateBrandProfile, updateBrandFeedCadence, addBrandDraft, updateBrandDraft, removeBrandDraft, addBrandMember, updateBrandMember, removeBrandMember, switchBrand };
}
