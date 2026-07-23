import { createClient } from '@supabase/supabase-js';
import { FileSystemNode, UserProfile, Brand, CalendarEvent, BrandSpace } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The whole file-system tree is stored as a single per-user JSON blob in
// `sosa_data`, keyed by (user_id, 'file_system'). RLS enforces per-user access.
const FS_KEY = 'file_system';

// Prefer the LOCAL session (read from storage, auto-refreshed by supabase-js)
// over auth.getUser(), which is a network round-trip on EVERY save/load — a
// flaky network there used to turn into a silent "save returned false".
const currentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;
  const { data } = await supabase.auth.getUser(); // fallback only
  return data.user?.id ?? null;
};

// --- DATA PERSISTENCE ---

// Returns true on a confirmed successful write, false otherwise. Never writes an
// empty tree — an empty `{}` must never be allowed to overwrite real user data.
export const saveNodesToSupabase = async (nodes: Record<string, FileSystemNode>): Promise<boolean> => {
  const userId = await currentUserId();
  if (!userId) return false;
  if (!nodes || Object.keys(nodes).length === 0) return false;
  const { error } = await supabase
    .from('sosa_data')
    .upsert({ user_id: userId, key: FS_KEY, data: nodes }, { onConflict: 'user_id,key' });
  if (error) { console.error('Error saving nodes:', error.message); return false; }
  return true;
};

// Discriminated load result so callers can tell "genuinely empty" (safe to seed
// defaults) apart from "load failed" (must NOT seed defaults — that would wipe data).
export type LoadNodesResult =
  | { status: 'ok'; nodes: Record<string, FileSystemNode> }
  | { status: 'empty' }
  | { status: 'error' };

export const loadNodesFromSupabase = async (): Promise<LoadNodesResult> => {
  const userId = await currentUserId();
  if (!userId) return { status: 'error' };
  const { data, error } = await supabase
    .from('sosa_data')
    .select('data')
    .eq('user_id', userId)
    .eq('key', FS_KEY)
    .maybeSingle();
  if (error) {
    console.error('Error loading nodes:', error.message);
    return { status: 'error' };
  }
  const nodes = data?.data as Record<string, FileSystemNode> | undefined;
  if (nodes && Object.keys(nodes).length > 0) return { status: 'ok', nodes };
  return { status: 'empty' };
};

// --- CALENDAR EVENTS ---
// Brand-wide milestones, stored in the SAME `sosa_data` table under a SEPARATE
// key so they never touch the (data-loss-sensitive) file_system blob.
const EVENTS_KEY = 'calendar_events';

export type LoadEventsResult =
  | { status: 'ok'; events: CalendarEvent[] }
  | { status: 'empty' }
  | { status: 'error' };

export const loadCalendarEvents = async (): Promise<LoadEventsResult> => {
  const userId = await currentUserId();
  if (!userId) return { status: 'error' };
  const { data, error } = await supabase
    .from('sosa_data')
    .select('data')
    .eq('user_id', userId)
    .eq('key', EVENTS_KEY)
    .maybeSingle();
  if (error) { console.error('Error loading calendar events:', error.message); return { status: 'error' }; }
  const events = data?.data as CalendarEvent[] | undefined;
  if (Array.isArray(events)) return { status: 'ok', events };
  return { status: 'empty' };
};

// Returns true on confirmed write. Empty [] is a valid state — but the CALLER
// must only save after a successful load (gated), never on a load error, so we
// never clobber real events with [].
export const saveCalendarEvents = async (events: CalendarEvent[]): Promise<boolean> => {
  const userId = await currentUserId();
  if (!userId) return false;
  if (!Array.isArray(events)) return false;
  const { error } = await supabase
    .from('sosa_data')
    .upsert({ user_id: userId, key: EVENTS_KEY, data: events }, { onConflict: 'user_id,key' });
  if (error) { console.error('Error saving calendar events:', error.message); return false; }
  return true;
};

// --- BRAND SPACES ---
// The user's brand (workspace) list, stored in `sosa_data` under its own key —
// same safety shape as calendar events, never touching the file_system blob.
const BRANDS_KEY = 'brand_spaces';

export type LoadBrandsResult =
  | { status: 'ok'; brands: BrandSpace[] }
  | { status: 'empty' }
  | { status: 'error' };

export const loadBrandSpaces = async (): Promise<LoadBrandsResult> => {
  const userId = await currentUserId();
  if (!userId) return { status: 'error' };
  const { data, error } = await supabase
    .from('sosa_data')
    .select('data')
    .eq('user_id', userId)
    .eq('key', BRANDS_KEY)
    .maybeSingle();
  if (error) { console.error('Error loading brand spaces:', error.message); return { status: 'error' }; }
  const brands = data?.data as BrandSpace[] | undefined;
  if (Array.isArray(brands)) return { status: 'ok', brands };
  return { status: 'empty' };
};

// Caller must only save after a successful load (gated), never on a load error.
export const saveBrandSpaces = async (brands: BrandSpace[]): Promise<boolean> => {
  const userId = await currentUserId();
  if (!userId) return false;
  if (!Array.isArray(brands) || brands.length === 0) return false; // never persist an empty list
  const { error } = await supabase
    .from('sosa_data')
    .upsert({ user_id: userId, key: BRANDS_KEY, data: brands }, { onConflict: 'user_id,key' });
  if (error) { console.error('Error saving brand spaces:', error.message); return false; }
  return true;
};

// --- BOARD SHARING (read-only public links) ---
// `share_links` maps a random code → a whiteboard. Anonymous viewers read the
// board ONLY through the SECURITY DEFINER RPC `get_shared_board` (never the tree).
const randomCode = () =>
  (crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).slice(2)).slice(0, 22);

// The owner's existing (non-revoked) share code for a board, or null.
export const getShareLink = async (whiteboardId: string): Promise<string | null> => {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('share_links')
    .select('share_code')
    .eq('owner_id', userId)
    .eq('whiteboard_id', whiteboardId)
    .eq('revoked', false)
    .maybeSingle();
  if (error) { console.error('getShareLink:', error.message); return null; }
  return data?.share_code ?? null;
};

// Create (or reuse) a share code for a board. Returns the code, or null on failure.
export const createShareLink = async (whiteboardId: string): Promise<string | null> => {
  const existing = await getShareLink(whiteboardId);
  if (existing) return existing;
  const userId = await currentUserId();
  if (!userId) return null;
  const share_code = randomCode();
  const { error } = await supabase
    .from('share_links')
    .insert({ owner_id: userId, whiteboard_id: whiteboardId, share_code });
  if (error) { console.error('createShareLink:', error.message); return null; }
  return share_code;
};

// Revoke all share links for a board (link stops working immediately).
export const revokeShareLink = async (whiteboardId: string): Promise<boolean> => {
  const userId = await currentUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from('share_links')
    .update({ revoked: true })
    .eq('owner_id', userId)
    .eq('whiteboard_id', whiteboardId);
  if (error) { console.error('revokeShareLink:', error.message); return false; }
  return true;
};

// Anonymous: load a shared whiteboard node by code (via the SECURITY DEFINER RPC).
export const loadSharedBoard = async (code: string): Promise<FileSystemNode | null> => {
  const { data, error } = await supabase.rpc('get_shared_board', { p_code: code });
  if (error) { console.error('loadSharedBoard:', error.message); return null; }
  const node = (data as any)?.node as FileSystemNode | undefined;
  return node ?? null;
};

// --- MEDIA STORAGE ---
// Large media (images/video) lives in the public `media` Storage bucket, NOT as
// base64 inside the per-user JSON blob. Objects are namespaced per user:
// `media/${userId}/${uuid}.${ext}` (RLS lets a user write only under their own folder).
const MEDIA_BUCKET = 'media';

// Uploads a file and returns its public URL. Throws on failure (callers fall back
// to base64 via fileService.persistMedia so a transient error never loses the asset).
export const uploadMedia = async (file: File): Promise<string> => {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');
  const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt || (file.type.split('/')[1] || 'bin');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    // The path is a fresh UUID, so the object can never change: cache it for a
    // year instead of re-fetching every hour (matters most for heavy video).
    cacheControl: '31536000, immutable',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

// Best-effort delete of a previously-uploaded media object. No-op for non-Storage
// URLs (e.g. legacy base64 or external links).
export const deleteMediaByUrl = async (url: string): Promise<void> => {
  if (!url) return;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
};

// --- AUTH & PROFILE ---

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const res = await fetchUserProfile(userId);
  return res.status === 'ok' ? res.profile : null;
};

// Discriminated fetches. CRITICAL: a network/RLS failure must be distinguishable
// from "no row" — treating an error as "no profile" used to flip the onboarding
// gate to false, which both broke the UI and silently disabled ALL saving.
export type FetchProfileResult =
  | { status: 'ok'; profile: UserProfile | null }
  | { status: 'error' };
export type FetchBrandResult =
  | { status: 'ok'; brand: Brand | null }
  | { status: 'error' };

export const fetchUserProfile = async (userId: string): Promise<FetchProfileResult> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error loading profile:', error.message);
    return { status: 'error' };
  }
  return { status: 'ok', profile: (data as UserProfile | null) ?? null };
};

export const fetchUserBrand = async (userId: string): Promise<FetchBrandResult> => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error loading brand:', error.message);
    return { status: 'error' };
  }
  return { status: 'ok', brand: (data as Brand | null) ?? null };
};

export const getUserBrand = async (userId: string): Promise<Brand | null> => {
  const res = await fetchUserBrand(userId);
  return res.status === 'ok' ? res.brand : null;
};

// Returns true only on a confirmed write. Onboarding relies on this: if the write
// silently fails (network/RLS), the caller must NOT treat onboarding as complete,
// otherwise onboarding_complete stays false in the DB and re-fires on next login.
export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<boolean> => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' });
  if (error) { console.error('Error updating profile:', error.message); return false; }
  return true;
};

export const createBrand = async (brandData: Partial<Brand>) => {
  const { error } = await supabase.from('brands').insert(brandData);
  if (error) console.error('Error creating brand:', error.message);
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
