import { useState, useEffect, useRef, useCallback } from 'react';
import { FileSystemNode, CalendarEvent, BrandSpace } from '../types';
import { filterNodesByBrand, eventInBrand } from '../services/brandSpaces';
import { listMySharedBrands, publishBrandData } from '../services/teamsBackend';

/**
 * Owner side of Teams Phase 2. For every brand the owner has SHARED, publish that
 * brand's slice (its nodes + events + meta) to `brand_data` so members can read it.
 *
 * SAFETY: this is purely ADDITIVE — it never touches the file_system blob or the
 * existing save path. A failed publish only means the shared mirror is momentarily
 * stale; the owner's real data is never at risk. Debounced + gated on `nodesLoaded`.
 */
export function useOwnerMirror(args: {
  session: any;
  nodesLoaded: boolean;
  nodes: Record<string, FileSystemNode>;
  events: CalendarEvent[];
  brands: BrandSpace[];
}) {
  const { session, nodesLoaded, nodes, events, brands } = args;
  // clientBrandId → sharedBrandId, for brands this user owns + has shared.
  const [sharedMap, setSharedMap] = useState<Record<string, string>>({});
  const userId: string | undefined = session?.user?.id;

  const refresh = useCallback(async () => {
    if (!userId) { setSharedMap({}); return; }
    const list = await listMySharedBrands();
    const owned: Record<string, string> = {};
    for (const b of list) if (b.isOwner) owned[b.clientBrandId] = b.sharedBrandId;
    setSharedMap(owned);
  }, [userId]);

  // Load the owner's shared-brand map once per user.
  useEffect(() => { refresh(); }, [refresh]);

  // Publish the slices, debounced, whenever the data or the shared set changes.
  const latest = useRef({ nodes, events, brands });
  latest.current = { nodes, events, brands };
  useEffect(() => {
    if (!nodesLoaded || !userId) return;
    const entries = Object.entries(sharedMap);
    if (!entries.length) return;
    const timer = setTimeout(() => {
      const { nodes: n, events: e, brands: bs } = latest.current;
      for (const [clientId, sharedId] of entries) {
        const brand = bs.find(b => b.id === clientId);
        if (!brand) continue;
        publishBrandData(sharedId, {
          nodes: filterNodesByBrand(n, clientId),
          events: e.filter(ev => eventInBrand(ev, clientId)),
          brand: {
            name: brand.name, avatarUrl: brand.avatarUrl, icon: brand.icon,
            socialProfiles: brand.socialProfiles, feedCadence: brand.feedCadence,
            feedDrafts: brand.feedDrafts, members: brand.members,
          },
        });
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, events, brands, sharedMap, nodesLoaded, userId]);

  return { sharedMap, refresh };
}
