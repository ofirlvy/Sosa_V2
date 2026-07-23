import React, { createContext, useContext, useMemo } from 'react';
import { MockupProfile, BrandMember } from '../types';
import { resolveMockupProfile, ResolvedMockupProfile } from '../services/mockupProfile';

// The active brand's social identity, made available to any card on the board so
// the preview mockups (Instagram/Reels/Story) opened from a card render the SAME
// handle/name/picture the user set on the Feed page — instead of "Orbit Brand".
// The whiteboard is already scoped to the active brand, so this identity is the
// right one wherever a card lives.

export interface BrandIdentity {
  brandName?: string;
  avatarUrl?: string;
  socialProfiles?: { [channel: string]: MockupProfile };
  /** The active brand's resolved roster (owner + members) for card assignees. */
  members?: BrandMember[];
}

const BrandIdentityContext = createContext<BrandIdentity>({});

export const BrandIdentityProvider: React.FC<{ value: BrandIdentity; children: React.ReactNode }> = ({ value, children }) => {
  // Memoize so consumers don't re-render unless the identity actually changes.
  const v = useMemo(() => value, [value.brandName, value.avatarUrl, value.socialProfiles, value.members]);
  return <BrandIdentityContext.Provider value={v}>{children}</BrandIdentityContext.Provider>;
};

/** The active brand's roster (owner + members). Empty until App provides it. */
export const useBrandMembers = (): BrandMember[] => useContext(BrandIdentityContext).members || [];

/** Fully-resolved mockup profile for a channel (blank fields fall back to the brand). */
export const useMockupProfile = (channel: string): ResolvedMockupProfile => {
  const { brandName, avatarUrl, socialProfiles } = useContext(BrandIdentityContext);
  return useMemo(
    () => resolveMockupProfile(socialProfiles?.[channel], { brandName, avatarUrl }),
    [socialProfiles, channel, brandName, avatarUrl],
  );
};
