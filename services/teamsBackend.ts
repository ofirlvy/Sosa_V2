import { supabase } from './supabase';
import { FileSystemNode, CalendarEvent, BrandRole, BrandMember } from '../types';

// Teams Phase 2 — all cross-user DB calls for sharing a brand. Owner-authoritative
// mirror: the owner publishes a shared brand's slice to `brand_data`; members read
// it (+ realtime) and write only to `brand_comments`. RLS enforces everything;
// these are thin, discriminated, never-throw wrappers (same discipline as
// services/supabase.ts). See memory brand_spaces (Teams Phase 2) + the SQL schema.

const uid = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
};

const token = () =>
  (crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).slice(2)).slice(0, 28);

// The data slice an owner publishes for one shared brand (its nodes + events + meta).
export interface SharedBrandData {
  nodes: Record<string, FileSystemNode>;
  events: CalendarEvent[];
  brand: any; // name, avatarUrl, socialProfiles, feedCadence, feedDrafts, members…
}

// A shared brand as seen in a member's (or owner's) switcher.
export interface SharedBrandRef {
  sharedBrandId: string;
  clientBrandId: string;
  name: string;
  role: BrandRole;
  isOwner: boolean;
}

export interface BrandCommentRow {
  id: string;
  node_id: string | null;
  card_id: string | null;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  text: string;
  mentions: string[] | null;
  resolved: boolean | null;
  created_at: string;
}

// ---------------------------------------------------------------- OWNER

/** Create (or fetch) the shared_brands row for one of the owner's local brands. */
export const ensureSharedBrand = async (clientBrandId: string, name: string): Promise<string | null> => {
  const owner = await uid();
  if (!owner) return null;
  // upsert on (owner_id, client_brand_id); keep name fresh.
  const { data, error } = await supabase
    .from('shared_brands')
    .upsert({ owner_id: owner, client_brand_id: clientBrandId, name }, { onConflict: 'owner_id,client_brand_id' })
    .select('id')
    .maybeSingle();
  if (error) { console.error('ensureSharedBrand:', error.message); return null; }
  return (data as any)?.id ?? null;
};

/** Create an email-bound invite. The token remains available as an optional fallback link. */
export const createInvite = async (sharedBrandId: string, email: string, role: BrandRole): Promise<string | null> => {
  const owner = await uid();
  if (!owner) return null;
  const normalizedEmail = email.trim().toLowerCase();
  // Structural editor write-back is not implemented yet; the live sharing
  // backend currently supports the two roles that the shared view enforces.
  const inviteRole: BrandRole = role === 'viewer' ? 'viewer' : 'commenter';

  // Retrying the same address should be idempotent instead of failing a unique
  // (brand,email) constraint or creating several pending invitations.
  const { data: pending, error: lookupError } = await supabase
    .from('brand_invites')
    .select('id,token')
    .eq('shared_brand_id', sharedBrandId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .limit(1);
  if (lookupError) { console.error('createInvite lookup:', lookupError.message); return null; }
  const existing = (pending as any[])?.[0];
  if (existing) {
    const { error } = await supabase.from('brand_invites').update({ role: inviteRole }).eq('id', existing.id);
    if (error) { console.error('createInvite update:', error.message); return null; }
    return existing.token;
  }

  const t = token();
  const { error } = await supabase.from('brand_invites').insert({
    shared_brand_id: sharedBrandId, token: t, email: normalizedEmail || null, role: inviteRole, invited_by: owner,
  });
  if (error) { console.error('createInvite:', error.message); return null; }
  return t;
};

/** The owner-published mirror of a shared brand's data. Owner is the sole writer. */
export const publishBrandData = async (sharedBrandId: string, data: SharedBrandData): Promise<boolean> => {
  const owner = await uid();
  if (!owner) return false;
  const { error } = await supabase
    .from('brand_data')
    .upsert({ shared_brand_id: sharedBrandId, data, updated_by: owner, updated_at: new Date().toISOString() },
            { onConflict: 'shared_brand_id' });
  if (error) { console.error('publishBrandData:', error.message); return false; }
  return true;
};

export interface RosterRow { user_id: string; email: string | null; role: BrandRole; status: string; }
/** Accepted members of a shared brand (owner is derived separately, from the account). */
export const loadMembers = async (sharedBrandId: string): Promise<RosterRow[]> => {
  const { data, error } = await supabase
    .from('brand_members')
    .select('user_id,email,role,status')
    .eq('shared_brand_id', sharedBrandId);
  if (error) { console.error('loadMembers:', error.message); return []; }
  return (data as RosterRow[]) || [];
};

export interface InviteRow { id: string; email: string | null; role: BrandRole; token: string; status: string; }
export const loadInvites = async (sharedBrandId: string): Promise<InviteRow[]> => {
  const { data, error } = await supabase
    .from('brand_invites')
    .select('id,email,role,token,status')
    .eq('shared_brand_id', sharedBrandId)
    .eq('status', 'pending');
  if (error) { console.error('loadInvites:', error.message); return []; }
  return (data as InviteRow[]) || [];
};

export const updateMemberRole = async (sharedBrandId: string, userId: string, role: BrandRole): Promise<boolean> => {
  const { error } = await supabase.from('brand_members').update({ role }).eq('shared_brand_id', sharedBrandId).eq('user_id', userId);
  if (error) { console.error('updateMemberRole:', error.message); return false; }
  return true;
};
export const removeMember = async (sharedBrandId: string, userId: string): Promise<boolean> => {
  const { error } = await supabase.from('brand_members').delete().eq('shared_brand_id', sharedBrandId).eq('user_id', userId);
  if (error) { console.error('removeMember:', error.message); return false; }
  return true;
};
export const revokeInvite = async (inviteId: string): Promise<boolean> => {
  const { error } = await supabase.from('brand_invites').delete().eq('id', inviteId);
  if (error) { console.error('revokeInvite:', error.message); return false; }
  return true;
};

// ---------------------------------------------------------------- MEMBER

/**
 * Claim every pending invite whose normalized email matches the authenticated
 * user's verified Supabase email. The RPC derives both identity and email from
 * auth; the browser never gets to choose which email to claim.
 */
export const claimInvitesForSignedInEmail = async (): Promise<boolean> => {
  const { error } = await supabase.rpc('claim_brand_invites_by_email');
  if (error) { console.error('claimInvitesForSignedInEmail:', error.message); return false; }
  return true;
};

/** Every shared brand the current user can see: their own (isOwner) + ones shared
 *  with them. Roles: owned → 'owner'; else from their brand_members row. */
export const listMySharedBrands = async (): Promise<SharedBrandRef[]> => {
  const me = await uid();
  if (!me) return [];
  // Safe to run repeatedly: the server function is idempotent and only claims
  // invitations for the email embedded in this signed-in user's JWT.
  await claimInvitesForSignedInEmail();
  const { data: brands, error } = await supabase
    .from('shared_brands')
    .select('id,owner_id,client_brand_id,name');
  if (error) { console.error('listMySharedBrands:', error.message); return []; }
  const { data: mine } = await supabase
    .from('brand_members')
    .select('shared_brand_id,role')
    .eq('user_id', me);
  const roleByBrand = new Map((mine || []).map((m: any) => [m.shared_brand_id, m.role as BrandRole]));
  return (brands || []).map((b: any) => ({
    sharedBrandId: b.id,
    clientBrandId: b.client_brand_id,
    name: b.name || 'Shared brand',
    isOwner: b.owner_id === me,
    role: b.owner_id === me ? 'owner' : (roleByBrand.get(b.id) || 'viewer'),
  }));
};

/** Accept an invite token → become a member. Returns the brand ref or null. */
export const acceptInvite = async (t: string): Promise<{ sharedBrandId: string; name: string; role: BrandRole } | null> => {
  const { data, error } = await supabase.rpc('accept_brand_invite', { p_token: t });
  if (error) { console.error('acceptInvite:', error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { sharedBrandId: row.shared_brand_id, name: row.name || 'Shared brand', role: row.role };
};

/** Load the owner-published data of a shared brand (read-only for members). */
export const loadBrandData = async (sharedBrandId: string): Promise<SharedBrandData | null> => {
  const { data, error } = await supabase
    .from('brand_data')
    .select('data')
    .eq('shared_brand_id', sharedBrandId)
    .maybeSingle();
  if (error) { console.error('loadBrandData:', error.message); return null; }
  return ((data as any)?.data as SharedBrandData) ?? null;
};

export const loadComments = async (sharedBrandId: string): Promise<BrandCommentRow[]> => {
  const { data, error } = await supabase
    .from('brand_comments')
    .select('*')
    .eq('shared_brand_id', sharedBrandId)
    .order('created_at', { ascending: true });
  if (error) { console.error('loadComments:', error.message); return []; }
  return (data as BrandCommentRow[]) || [];
};

export const postComment = async (
  sharedBrandId: string,
  c: { nodeId?: string; cardId?: string; text: string; mentions?: string[]; authorName?: string; authorAvatar?: string },
): Promise<boolean> => {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase.from('brand_comments').insert({
    shared_brand_id: sharedBrandId,
    node_id: c.nodeId || null,
    card_id: c.cardId || null,
    author_id: me,
    author_name: c.authorName || null,
    author_avatar: c.authorAvatar || null,
    text: c.text,
    mentions: c.mentions && c.mentions.length ? c.mentions : null,
  });
  if (error) { console.error('postComment:', error.message); return false; }
  return true;
};

export const setCommentResolved = async (id: string, resolved: boolean): Promise<boolean> => {
  const { error } = await supabase.from('brand_comments').update({ resolved }).eq('id', id);
  if (error) { console.error('setCommentResolved:', error.message); return false; }
  return true;
};

/** Live updates for a shared brand: owner's data pushes + new comments. Returns
 *  an unsubscribe fn. */
export const subscribeBrand = (
  sharedBrandId: string,
  handlers: { onData?: () => void; onComment?: () => void },
): (() => void) => {
  const ch = supabase
    .channel(`brand-${sharedBrandId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_data', filter: `shared_brand_id=eq.${sharedBrandId}` }, () => handlers.onData?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_comments', filter: `shared_brand_id=eq.${sharedBrandId}` }, () => handlers.onComment?.())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
};

// ---------------------------------------------------------------- pure mappers (tested)

/** Map DB member rows (+ owner from the account) into the Phase-1 BrandMember shape
 *  the MembersModal/AssigneeStack already render. Members have no readable name
 *  (profiles is own-only under RLS), so we derive one from the email. */
export const nameFromEmail = (email: string | null | undefined): string =>
  (email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Member';

export const rosterFromRows = (
  rows: RosterRow[],
  invites: InviteRow[],
  owner: { id: string; name: string; email?: string; avatarUrl?: string } | null,
): BrandMember[] => {
  const out: BrandMember[] = [];
  if (owner) out.push({ id: `owner:${owner.id}`, name: owner.name || 'You', email: owner.email || '', avatarUrl: owner.avatarUrl, role: 'owner', status: 'active' });
  for (const r of rows) {
    if (owner && r.user_id === owner.id) continue; // owner already shown
    out.push({ id: r.user_id, name: nameFromEmail(r.email), email: r.email || '', role: r.role, status: 'active' });
  }
  for (const i of invites) {
    out.push({ id: `invite:${i.id}`, name: nameFromEmail(i.email), email: i.email || '', role: i.role, status: 'invited' });
  }
  return out;
};
