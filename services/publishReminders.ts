import { FileSystemNode, CardData, CardType, PublishTarget, PublishPlatform } from '../types';

// Phase B publishing engine (semi-auto, no platform APIs): cards carry
// content.publishTargets; every minute the app scans for due targets, flips
// them to `needs_action`, and fires a reminder that opens the Publish Kit
// (media download + caption copy + deep link to the platform composer).
// Phase C upgrades connected platforms to server-side auto-publish.
// The due/scan logic is pure and unit-tested (tests/publishTargets.test.ts).

export interface QueueItem {
  target: PublishTarget;
  card: CardData;
  nodeId: string;
  workspaceId: string;
}

const PUBLISHABLE_TYPES = [CardType.POST, CardType.REELS];

/** All publish targets across every whiteboard, sorted by time ascending. */
export const collectQueue = (nodes: Record<string, FileSystemNode>): QueueItem[] => {
  const items: QueueItem[] = [];
  for (const node of Object.values(nodes)) {
    if (node?.type !== 'whiteboard' || !node.whiteboardData) continue;
    for (const ws of node.whiteboardData) {
      for (const card of ws.cards || []) {
        if (!PUBLISHABLE_TYPES.includes(card.type)) continue;
        const targets = ((card.content as any)?.publishTargets || []) as PublishTarget[];
        for (const target of targets) {
          items.push({ target, card, nodeId: node.id, workspaceId: ws.id });
        }
      }
    }
  }
  return items.sort((a, b) => Date.parse(a.target.at) - Date.parse(b.target.at));
};

/**
 * Pure: which targets are DUE at `now` — scheduled, and their time has arrived.
 * (needs_action items are already announced; published/canceled are done.)
 */
export const dueTargets = (items: QueueItem[], now: number): QueueItem[] =>
  items.filter(i => i.target.status === 'scheduled' && Date.parse(i.target.at) <= now);

/** Pure: mark the given target ids as needs_action inside a card's content. */
export const markTargetsNeedAction = (content: any, targetIds: string[]): any => {
  const targets = (content?.publishTargets || []) as PublishTarget[];
  return {
    ...content,
    publishTargets: targets.map(t => targetIds.includes(t.id) ? { ...t, status: 'needs_action' as const } : t),
  };
};

/** Pure: set one target's status (publish kit actions: published / canceled / re-scheduled). */
export const setTargetStatus = (content: any, targetId: string, status: PublishTarget['status']): any => {
  const targets = (content?.publishTargets || []) as PublishTarget[];
  return {
    ...content,
    publishTargets: targets.map(t => t.id === targetId
      ? { ...t, status, ...(status === 'published' ? { publishedAt: new Date().toISOString() } : {}) }
      : t),
  };
};

// --- Platform metadata for the Publish Kit / modal ---
export const PLATFORM_META: Record<PublishPlatform, { label: string; composerUrl: string; captionLimit: number }> = {
  instagram: { label: 'Instagram', composerUrl: 'https://www.instagram.com/', captionLimit: 2200 },
  facebook:  { label: 'Facebook',  composerUrl: 'https://www.facebook.com/', captionLimit: 63206 },
  tiktok:    { label: 'TikTok',    composerUrl: 'https://www.tiktok.com/upload', captionLimit: 2200 },
  pinterest: { label: 'Pinterest', composerUrl: 'https://www.pinterest.com/pin-builder/', captionLimit: 800 },
};

/** Ask once for Web Notification permission; fire a reminder if granted. */
export const notifyDue = async (items: QueueItem[]): Promise<void> => {
  if (items.length === 0 || typeof Notification === 'undefined') return;
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    const first = items[0];
    const title = (first.card.content as any)?.title || 'Untitled';
    const body = items.length === 1
      ? `"${title}" is ready to publish to ${PLATFORM_META[first.target.platform].label}`
      : `${items.length} posts are ready to publish`;
    new Notification('Sosa — time to publish', { body });
  } catch { /* notifications unavailable (permissions / platform) */ }
};
