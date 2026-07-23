import { useState, useEffect, useCallback } from 'react';
import { BrandMember } from '../types';
import { loadMembers, loadInvites, rosterFromRows } from '../services/teamsBackend';

/**
 * The roster for the active brand. If the brand is SHARED (has a sharedBrandId),
 * the roster is the real DB one (accepted members + pending invites + the owner);
 * otherwise it falls back to the local Phase-1 roster. Keeps card assignees,
 * @mentions and the Members modal all reading the same source.
 */
export function useSharedRoster(args: {
  sharedBrandId: string | null;
  localRoster: BrandMember[];
  owner: { id: string; name: string; email?: string; avatarUrl?: string } | null;
}) {
  const { sharedBrandId, localRoster, owner } = args;
  const [dbRoster, setDbRoster] = useState<BrandMember[] | null>(null);

  const reloadRoster = useCallback(async () => {
    if (!sharedBrandId) { setDbRoster(null); return; }
    const [rows, invites] = await Promise.all([loadMembers(sharedBrandId), loadInvites(sharedBrandId)]);
    setDbRoster(rosterFromRows(rows, invites, owner));
  }, [sharedBrandId, owner?.id]);

  useEffect(() => { reloadRoster(); }, [reloadRoster]);

  return { roster: sharedBrandId && dbRoster ? dbRoster : localRoster, reloadRoster };
}
