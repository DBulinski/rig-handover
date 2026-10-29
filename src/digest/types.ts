// Plan morning-digest § 1. The run log reader's types; the reader is in read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null here; the view shows `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // most recent `error` seen for this job, null if none
  firstAt: string; // as written in the log, offset kept
  lastAt: string;
};

// A night with no file is `null`; an empty file is `{ rows: [], badLines: 0 }`.
export type Digest = {
  rows: DigestRow[]; // in order of first appearance in the log
  badLines: number; // lines that didn't parse or didn't match the shape
};

export type ReadNight = (runsDir: string, night: string) => Digest | null;
