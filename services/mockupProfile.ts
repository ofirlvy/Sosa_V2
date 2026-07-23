import type { MockupProfile, MockupHighlight } from '../types';

// Pure resolution of the Feed page's phone-mockup social profile.
//
// The username/avatar fallback chain used to be copy-pasted in four places
// (PhoneFeedMockup, InstagramPreviewModal, StoryPreviewModal, ReelsPreviewModal)
// and the bio/link were hardcoded strings. This module is the single source of
// truth: views read a fully-resolved profile and never re-derive defaults.

/** A profile with every field decided — what the UI actually renders. */
export interface ResolvedMockupProfile {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  link: string;
  highlights: MockupHighlight[];
}

export interface MockupProfileFallback {
  brandName?: string;
  avatarUrl?: string;
}

/** Instagram-ish handle: no leading @, no whitespace, lowercase. */
export const sanitizeUsername = (raw: string): string =>
  raw.trim().replace(/^@+/, '').replace(/\s+/g, '_').toLowerCase();

// Treat whitespace-only input as "not set" so clearing a field in the edit
// sheet restores the brand default rather than rendering a blank profile.
const filled = (v?: string): string => (typeof v === 'string' && v.trim() ? v.trim() : '');

const avatarFor = (name: string): string =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Brand')}&background=EDEDED&color=555&size=200`;

/**
 * Merge a (possibly empty) stored profile with the brand's identity.
 * Never mutates; safe to call on every render.
 */
export const resolveMockupProfile = (
  profile: MockupProfile | undefined,
  fallback: MockupProfileFallback = {},
): ResolvedMockupProfile => {
  const brandName = filled(fallback.brandName) || 'Your brand';
  const displayName = filled(profile?.displayName) || brandName;
  const username = sanitizeUsername(filled(profile?.username) || brandName) || 'brand_account';
  return {
    username,
    displayName,
    avatarUrl: filled(profile?.avatarUrl) || filled(fallback.avatarUrl) || avatarFor(displayName),
    bio: filled(profile?.bio),
    link: filled(profile?.link),
    highlights: profile?.highlights ?? [],
  };
};

/** Add a highlight, or replace the existing one with the same id. */
export const upsertHighlight = (list: MockupHighlight[], h: MockupHighlight): MockupHighlight[] =>
  list.some(x => x.id === h.id) ? list.map(x => (x.id === h.id ? h : x)) : [...list, h];

export const removeHighlight = (list: MockupHighlight[], id: string): MockupHighlight[] =>
  list.filter(x => x.id !== id);
