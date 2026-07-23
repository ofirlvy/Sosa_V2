// Local-date helpers. We deliberately avoid Date.toISOString() for calendar /
// slot dates: it converts to UTC and shifts the day for non-UTC timezones,
// which caused the calendar / feed-planner / post-card dates to disagree.

/** Format a Date as YYYY-MM-DD using LOCAL year/month/day (no timezone shift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD (or ISO) string into a Date at LOCAL midnight. */
export function parseISODate(s: string): Date {
  if (!s) return new Date(NaN);
  // Take just the date part and anchor to local midnight.
  const datePart = s.split('T')[0];
  return new Date(datePart + 'T00:00:00');
}
