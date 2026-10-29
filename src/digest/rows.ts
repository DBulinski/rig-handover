import type { DigestRow } from './types.js';

// The page and the JSON both sort with this, so they never disagree (plan § 2b, ADR 0001).
export function sortByJob(rows: DigestRow[]): DigestRow[] {
  return [...rows].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

// A night is YYYY-MM-DD. Check it before readNight, so `../` never reaches the file system.
export function isNight(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
