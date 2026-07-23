import { describe, it, expect } from 'vitest';
import { nameFromEmail, rosterFromRows, RosterRow, InviteRow } from '../services/teamsBackend';

// The pure roster mapper turns DB rows (+ the account owner) into the Phase-1
// BrandMember shape the UI already renders. Members have no readable name under
// RLS, so it's derived from the email.

describe('nameFromEmail', () => {
  it('title-cases the local part', () => {
    expect(nameFromEmail('bob.ross@x.com')).toBe('Bob Ross');
    expect(nameFromEmail('cara_delevingne@x.com')).toBe('Cara Delevingne');
    expect(nameFromEmail(null)).toBe('Member');
  });
});

describe('rosterFromRows', () => {
  const owner = { id: 'u1', name: 'Ada', email: 'ada@x.com' };
  const members: RosterRow[] = [
    { user_id: 'u2', email: 'bob@x.com', role: 'editor', status: 'active' },
    { user_id: 'u1', email: 'ada@x.com', role: 'owner', status: 'active' }, // dup owner → skipped
  ];
  const invites: InviteRow[] = [{ id: 'i1', email: 'cara@x.com', role: 'commenter', token: 't', status: 'pending' }];

  it('puts the owner first, then members, then pending invites (no dup owner)', () => {
    const roster = rosterFromRows(members, invites, owner);
    expect(roster.map(m => [m.id, m.role, m.status])).toEqual([
      ['owner:u1', 'owner', 'active'],
      ['u2', 'editor', 'active'],
      ['invite:i1', 'commenter', 'invited'],
    ]);
    expect(roster[1].name).toBe('Bob'); // derived from email
  });

  it('works with no owner (member viewing)', () => {
    const roster = rosterFromRows(members, [], null);
    expect(roster.map(m => m.id)).toEqual(['u2', 'u1']); // no owner-dedup when owner unknown
  });
});
