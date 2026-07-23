import { useState, useEffect, useCallback } from 'react';
import { listMySharedBrands, loadBrandData, acceptInvite, subscribeBrand, SharedBrandRef, SharedBrandData } from '../services/teamsBackend';

/**
 * Member side of Teams Phase 2. Discovers brands shared WITH the current user,
 * loads a shared brand's owner-published data (read-only), and keeps it live via
 * realtime. The member NEVER writes structural data — this data is rendered in a
 * self-contained read-only view, so the member's own file_system is never touched.
 */
export function useMemberBrands(session: any) {
  const [sharedWithMe, setSharedWithMe] = useState<SharedBrandRef[]>([]);
  const [activeSharedId, setActiveSharedId] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedBrandData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const userId: string | undefined = session?.user?.id;

  const refresh = useCallback(async () => {
    if (!userId) { setSharedWithMe([]); return; }
    const list = await listMySharedBrands();
    setSharedWithMe(list.filter(b => !b.isOwner));
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);
  // A shared brand can't be open once we log out.
  useEffect(() => { if (!userId) { setActiveSharedId(null); setSharedData(null); } }, [userId]);

  // Load + live-subscribe the active shared brand's data.
  useEffect(() => {
    if (!activeSharedId) { setSharedData(null); return; }
    let alive = true;
    setLoadingData(true);
    const load = () => loadBrandData(activeSharedId).then(d => { if (alive) { setSharedData(d); setLoadingData(false); } });
    load();
    const unsub = subscribeBrand(activeSharedId, { onData: load });
    return () => { alive = false; unsub(); };
  }, [activeSharedId]);

  const openShared = useCallback((id: string) => setActiveSharedId(id), []);
  const closeShared = useCallback(() => setActiveSharedId(null), []);
  const acceptAndOpen = useCallback(async (token: string) => {
    const r = await acceptInvite(token);
    await refresh();
    if (r) setActiveSharedId(r.sharedBrandId);
    return r;
  }, [refresh]);

  const activeShared = sharedWithMe.find(b => b.sharedBrandId === activeSharedId) || null;
  return { sharedWithMe, activeSharedId, activeShared, sharedData, loadingData, openShared, closeShared, acceptAndOpen, refreshShared: refresh };
}
