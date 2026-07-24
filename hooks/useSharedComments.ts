import { useState, useEffect, useCallback, useRef } from 'react';
import { BrandCommentRow, loadComments, postComment, setCommentResolved, subscribeBrand } from '../services/teamsBackend';

/**
 * Comments for a shared brand — a SEPARATE write surface from `brand_data`
 * (Teams Phase 2 Round 2): RLS lets viewer+ read, commenter+ insert, author/owner
 * resolve. So a Commenter can always comment even while every OTHER shared-brand
 * write is blocked by `useSharedWorkspace.readOnly`. `node_id`/`card_id` on a row
 * are how a message that references a specific post/reel/story gets attached to
 * the right board+card — the composer just needs to set them (see BoardChatDrawer's
 * existing card-picker attachment; App maps it straight through).
 */
export function useSharedComments(sharedBrandId: string | null) {
  const [items, setItems] = useState<BrandCommentRow[]>([]);
  const sidRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!sharedBrandId) { setItems([]); return; }
    const rows = await loadComments(sharedBrandId);
    setItems(rows);
  }, [sharedBrandId]);

  useEffect(() => {
    sidRef.current = sharedBrandId;
    reload();
    if (!sharedBrandId) return;
    const unsub = subscribeBrand(sharedBrandId, { onComment: reload });
    return () => unsub();
  }, [sharedBrandId, reload]);

  const send = useCallback((
    nodeId: string, cardId: string | undefined, text: string, mentions: string[] | undefined,
    authorName?: string, authorAvatar?: string,
  ) => {
    if (!sharedBrandId) return;
    postComment(sharedBrandId, { nodeId, cardId, text, mentions, authorName, authorAvatar }).then(reload);
  }, [sharedBrandId, reload]);

  const toggleResolved = useCallback((id: string) => {
    const current = items.find(c => c.id === id);
    if (!current) return;
    setCommentResolved(id, !current.resolved).then(reload);
  }, [items, reload]);

  return { items, send, toggleResolved };
}
