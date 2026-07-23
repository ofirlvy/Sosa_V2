import { describe, it, expect } from 'vitest';
import { BrandSpace, BrandMember, UserProfile } from '../types';
import {
  resolveRoster, canEdit, canComment, canManageMembers, initials,
  isValidEmail, parseMentionQuery, insertMention, OWNER_MEMBER_PREFIX,
} from '../services/brandMembers';

const owner: UserProfile = { id: 'u1', full_name: 'Ada Lovelace', email: 'ada@x.com', onboarding_complete: true };
const member = (over: Partial<BrandMember> = {}): BrandMember => ({
  id: 'm1', name: 'Bob', email: 'bob@x.com', role: 'editor', status: 'invited', ...over,
});
const brand = (members: BrandMember[]): BrandSpace => ({ id: 'b', name: 'B', members });

describe('resolveRoster', () => {
  it('prepends the account owner (derived) and keeps invited members', () => {
    const roster = resolveRoster(brand([member()]), owner);
    expect(roster[0]).toMatchObject({ id: `${OWNER_MEMBER_PREFIX}u1`, role: 'owner', name: 'Ada Lovelace' });
    expect(roster.map(m => m.id)).toEqual([`${OWNER_MEMBER_PREFIX}u1`, 'm1']);
  });
  it('never renders a second owner and de-dupes by id', () => {
    const roster = resolveRoster(brand([member({ id: 'x', role: 'owner' }), member({ id: 'm1' }), member({ id: 'm1' })]), owner);
    expect(roster.filter(m => m.role === 'owner')).toHaveLength(1);
    expect(roster.map(m => m.id)).toEqual([`${OWNER_MEMBER_PREFIX}u1`, 'm1']);
  });
  it('with no owner profile, returns just the members', () => {
    expect(resolveRoster(brand([member()]), null).map(m => m.id)).toEqual(['m1']);
  });
});

describe('role capabilities', () => {
  it('canEdit only owner/editor', () => {
    expect(canEdit('owner')).toBe(true);
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('commenter')).toBe(false);
    expect(canEdit('viewer')).toBe(false);
  });
  it('canComment everyone but viewer; canManageMembers owner only', () => {
    expect(canComment('commenter')).toBe(true);
    expect(canComment('viewer')).toBe(false);
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('editor')).toBe(false);
  });
});

describe('helpers', () => {
  it('initials + isValidEmail', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('cher')).toBe('C');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
});

describe('parseMentionQuery', () => {
  it('returns the query when the caret is in an @token', () => {
    expect(parseMentionQuery('hey @bo', 7)).toBe('bo');
    expect(parseMentionQuery('@a', 2)).toBe('a');
    expect(parseMentionQuery('hey @', 5)).toBe('');
  });
  it('returns null when not in a token', () => {
    expect(parseMentionQuery('hey there', 9)).toBeNull();      // no @
    expect(parseMentionQuery('email a@b.com', 13)).toBeNull(); // @ not word-start
    expect(parseMentionQuery('@bob and more', 13)).toBeNull(); // whitespace closed it
  });
});

describe('insertMention', () => {
  it('replaces the @token with "@Name " and moves the caret', () => {
    const r = insertMention('hey @bo', 7, member({ name: 'Bob' }));
    expect(r.text).toBe('hey @Bob ');
    expect(r.caret).toBe(9);
  });
  it('keeps trailing text after the caret', () => {
    const r = insertMention('hi @b!', 5, member({ name: 'Bob' }));
    expect(r.text).toBe('hi @Bob !');
  });
});
