import { useState, useEffect, useRef } from 'react';
import { UserProfile, Brand } from '../types';
import { supabase, fetchUserProfile, fetchUserBrand, updateUserProfile } from '../services/supabase';
import { resolveOnboardingGate } from '../services/persistenceDecision';

/**
 * Manages authentication state, the onboarding gate, and the current user's
 * profile + brand. Self-contained — owns the auth listener lifecycle.
 *
 * PERSISTENCE-CRITICAL (see memory persistence_invariants):
 * `onboardingComplete` gates EVERY save effect (useFileSystem, useCalendarEvents,
 * useBrandSpaces). It must therefore behave like a load decision, not a boolean
 * guess:
 *   1. It may only ever be raised/lowered from a SUCCESSFUL profile fetch. A
 *      network/RLS error must never lower it — that used to render the onboarding
 *      screen mid-session AND silently stop all saving (edits made after that
 *      point were lost on refresh).
 *   2. The profile is fetched once per user id, not on every auth event.
 *      `onAuthStateChange` also fires on TOKEN_REFRESHED, so re-fetching there
 *      turned every token refresh into a chance to break the session.
 */
export function useAuth() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);

  // The user id we've already resolved the profile for — prevents re-checking on
  // token refreshes and other auth events for the same user.
  const checkedUserIdRef = useRef<string | null>(null);
  const inFlightUserIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = () => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
  };

  /**
   * Resolve profile + brand for a user. On a fetch ERROR nothing is written to
   * state (the previous values stand) and we retry with backoff — the gate is
   * never lowered by a transient failure.
   */
  const checkOnboarding = async (userId: string, tries = 0) => {
    // Both getSession() and the auth listener can race on first mount.
    if (tries === 0 && inFlightUserIdRef.current === userId) return;
    inFlightUserIdRef.current = userId;

    const [profileRes, brandRes] = await Promise.all([
      fetchUserProfile(userId),
      fetchUserBrand(userId),
    ]);

    if (profileRes.status === 'error') {
      clearRetry();
      if (tries < 5) {
        // Keep the spinner while we've never resolved this user (so a failed first
        // fetch can't show the onboarding screen to an existing account).
        if (checkedUserIdRef.current !== userId) setAuthLoading(true);
        retryTimerRef.current = setTimeout(() => checkOnboarding(userId, tries + 1), Math.min(500 * 2 ** tries, 15000));
        return;
      }
      inFlightUserIdRef.current = null;
      setAuthLoading(false); // give up spinning; the gate keeps its last known value
      return;
    }

    // Success — this is the ONLY place the gate may change (pure rule, unit-tested).
    checkedUserIdRef.current = userId;
    inFlightUserIdRef.current = null;
    setUserProfile(profileRes.profile);
    setOnboardingComplete(prev => resolveOnboardingGate(profileRes, prev));
    if (brandRes.status === 'ok') setBrand(brandRes.brand); // brand failure is non-fatal
    setAuthLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const uid = session?.user?.id;
      if (!uid) {
        // Real sign-out: reset the gate and the cached identity.
        clearRetry();
        checkedUserIdRef.current = null;
        inFlightUserIdRef.current = null;
        setOnboardingComplete(false);
        setUserProfile(null);
        setBrand(null);
        setAuthLoading(false);
        return;
      }
      // Same user (token refresh, tab focus, …) → keep the resolved state as-is.
      if (checkedUserIdRef.current === uid) return;
      checkOnboarding(uid);
    });

    return () => { subscription.unsubscribe(); clearRetry(); };
  }, []);

  const handleDismissTour = async () => {
    if (!session?.user?.id) return;
    try {
      await updateUserProfile(session.user.id, { tour_completed: true });
      if (userProfile) setUserProfile({ ...userProfile, tour_completed: true });
    } catch (e) {
      console.error("Failed to dismiss tour", e);
    }
  };

  return {
    session,
    authLoading,
    authView,
    setAuthView,
    onboardingComplete,
    setOnboardingComplete,
    userProfile,
    setUserProfile,
    brand,
    handleDismissTour,
  };
}
