import { BrandSpace, BrandMember, BrandRole, UserProfile } from '../types';

// Pure people-layer logic for a brand: the roster (owner + invited members),
// role capabilities, and the @-mention parsing shared by the chat composer.
// Access is always PER-BRAND — an individual can share one brand without
// exposing the rest. Real cross-user sign-in is a backend round; here the roster
// is real and drives card assignees + @mentions. See memory brand_spaces.

/** Stable id for the account owner as a member (derived, never stored per brand). */
export const OWNER_MEMBER_PREFIX = 'owner:';

/**
 * The displayed roster for a brand = the account owner (from their profile,
 * role 'owner') followed by the brand's invited members, de-duplicated by id.
 * The owner is derived — never written into every brand's `members` — so it can
 * never go stale.
 */
export const resolveRoster = (
  brand: BrandSpace | undefined,
  owner: UserProfile | null | undefined,
): BrandMember[] => {
  const roster: BrandMember[] = [];
  if (owner?.id) {
    roster.push({
      id: `${OWNER_MEMBER_PREFIX}${owner.id}`,
      name: owner.full_name || 'You',
      email: owner.email || '',
      avatarUrl: owner.avatar_url,
      role: 'owner',
      status: 'active',
    });
  }
  const seen = new Set(roster.map(m => m.id));
  for (const m of brand?.members || []) {
    if (m.role === 'owner' || seen.has(m.id)) continue; // one owner, no dupes
    roster.push(m);
    seen.add(m.id);
  }
  return roster;
};

/** Look up a member in a roster by id. */
export const memberById = (roster: BrandMember[], id: string): BrandMember | undefined =>
  roster.find(m => m.id === id);

// --- Role capabilities ------------------------------------------------------
export const canEdit = (role: BrandRole): boolean => role === 'owner' || role === 'editor';
export const canComment = (role: BrandRole): boolean => role !== 'viewer';
export const canManageMembers = (role: BrandRole): boolean => role === 'owner';

export const ROLE_LABEL: Record<BrandRole, string> = {
  owner: 'Owner', editor: 'Editor', commenter: 'Commenter', viewer: 'Viewer',
};
export const ROLE_HINT: Record<BrandRole, string> = {
  owner: 'Full access + manage members',
  editor: 'Create, edit and schedule',
  commenter: 'View, comment and @mention',
  viewer: 'View only',
};
/** Roles an owner can assign to others (everything except a second owner). */
export const ASSIGNABLE_ROLES: BrandRole[] = ['editor', 'commenter', 'viewer'];

/** Two-letter initials for an avatar fallback. */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// --- @mention parsing (shared with the chat composer) -----------------------

/** If the caret sits in an active "@query" token, return the query (text after
 *  the '@', no whitespace); else null. Drives the member picker. */
export const parseMentionQuery = (text: string, caret: number): string | null => {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;
  // '@' must start a word (start of string or after whitespace).
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) return null; // whitespace closes the token
  return query;
};

/** Replace the active "@query" token at the caret with "@Name " and report the
 *  new caret position. Used when a member is picked. */
export const insertMention = (
  text: string, caret: number, member: BrandMember,
): { text: string; caret: number } => {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  const before = text.slice(0, at);
  const after = text.slice(caret);
  const token = `@${member.name} `;
  return { text: before + token + after, caret: (before + token).length };
};
