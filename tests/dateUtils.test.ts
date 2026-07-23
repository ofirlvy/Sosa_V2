import { describe, it, expect } from 'vitest';
import { toISODate, parseISODate } from '../services/dateUtils';

// LOCAL-date invariant: toISOString() converts to UTC and shifts the calendar
// day for non-UTC timezones — that caused calendar/feed/post dates to disagree.
// These helpers must round-trip the LOCAL calendar day exactly.

describe('dateUtils — LOCAL day preserved (no timezone shift)', () => {
  it('toISODate uses local Y-M-D', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');   // Jan 5
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31'); // Dec 31
  });

  it('parseISODate(toISODate(d)) preserves the local calendar day across a sweep', () => {
    for (let month = 0; month < 12; month++) {
      for (const day of [1, 12, 28]) {
        const d = new Date(2026, month, day, 13, 30); // afternoon — the shift-prone case
        const round = parseISODate(toISODate(d));
        expect(round.getFullYear()).toBe(d.getFullYear());
        expect(round.getMonth()).toBe(d.getMonth());
        expect(round.getDate()).toBe(d.getDate());
      }
    }
  });

  it('parseISODate anchors to local midnight', () => {
    const d = parseISODate('2026-03-09');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(9);
  });
});
