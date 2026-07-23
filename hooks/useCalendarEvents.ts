import { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '../types';
import { loadCalendarEvents, saveCalendarEvents } from '../services/supabase';

/**
 * Owns the brand-wide calendar events (the "marketing gantt") + persistence.
 * Events live in `sosa_data` under key `calendar_events` (separate from the
 * file_system blob). Same safety shape as useFileSystem: load once per user,
 * discriminated load (never clobber real data on a load error), gated +
 * debounced save, localStorage cache, flush-on-close. `[]` is a valid state.
 */
const cacheKeyFor = (uid: string) => `sosa_events_${uid}`;
const readCache = (uid: string): CalendarEvent[] | null => {
  try {
    const raw = localStorage.getItem(cacheKeyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};
const writeCache = (uid: string, events: CalendarEvent[]) => {
  try { localStorage.setItem(cacheKeyFor(uid), JSON.stringify(events)); } catch { /* quota */ }
};

interface UseCalendarEventsArgs {
  session: any;
  onboardingComplete: boolean;
}

export function useCalendarEvents({ session, onboardingComplete }: UseCalendarEventsArgs) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const loadedUserIdRef = useRef<string | null>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const latestRef = useRef<CalendarEvent[]>([]);
  latestRef.current = events;

  const userId: string | undefined = session?.user?.id;

  useEffect(() => {
    if (!userId) { loadedUserIdRef.current = null; setEventsLoaded(false); }
  }, [userId]);

  // Load once per user.
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current === userId) return;
    let cancelled = false;

    const cached = readCache(userId);
    if (cached) { setEvents(cached); setEventsLoaded(true); }

    const settle = (list: CalendarEvent[]) => {
      if (cancelled) return;
      setEvents(list);
      setEventsLoaded(true);
      lastSavedSerializedRef.current = JSON.stringify(list);
      latestRef.current = list;
      loadedUserIdRef.current = userId; // enables saving for this user
      writeCache(userId, list);
    };

    const attempt = async (tries: number) => {
      if (cancelled) return;
      const res = await loadCalendarEvents();
      if (cancelled) return;
      if (res.status === 'ok') { settle(res.events); return; }
      if (res.status === 'empty') { settle(cached || []); return; }
      // error → retry; never overwrite real data on transient failure.
      if (tries < 4) { setTimeout(() => attempt(tries + 1), 500 * 2 ** tries); return; }
      // Persistent failure: use cache if any; else start empty but mark "saved" so
      // we don't push [] over possibly-real DB data until the user actually edits.
      if (cached) { settle(cached); }
      else {
        setEvents([]);
        latestRef.current = [];
        lastSavedSerializedRef.current = JSON.stringify([]);
        loadedUserIdRef.current = userId;
        setEventsLoaded(true);
      }
    };

    attempt(0);
    return () => { cancelled = true; };
  }, [userId, onboardingComplete]);

  // Debounced save (gated on a completed load; skips unchanged).
  useEffect(() => {
    if (!userId || !onboardingComplete) return;
    if (loadedUserIdRef.current !== userId) return;
    const serialized = JSON.stringify(events);
    if (serialized === lastSavedSerializedRef.current) return;
    const timer = setTimeout(async () => {
      writeCache(userId, events);
      const ok = await saveCalendarEvents(events);
      if (ok) lastSavedSerializedRef.current = serialized;
    }, 800);
    return () => clearTimeout(timer);
  }, [events, userId, onboardingComplete]);

  // Flush on tab hide/close.
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (loadedUserIdRef.current !== userId) return;
      const serialized = JSON.stringify(latestRef.current);
      if (serialized === lastSavedSerializedRef.current) return;
      writeCache(userId, latestRef.current);
      saveCalendarEvents(latestRef.current);
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

  const addEvent = (data: Omit<CalendarEvent, 'id' | 'createdAt'>): string => {
    const id = `evt-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    const ev: CalendarEvent = { ...data, id, createdAt: new Date().toISOString() };
    setEvents(prev => [...prev, ev]);
    return id;
  };

  const updateEvent = (id: string, patch: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  return { events, eventsLoaded, addEvent, updateEvent, deleteEvent };
}
