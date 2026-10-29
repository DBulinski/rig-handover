import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('readNight', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.rows.map((r) => r.job)).toEqual([
      'rig/rotate-logs',
      'lane/sync',
      'fixtures/refresh',
      'notes/backup',
      'digest/render',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts runs and retries, keeps the last error and the offsets', () => {
    const fixtures = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    const render = night?.rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('tells no file from an empty file', () => {
    const dir = tempRuns({ '2026-01-01.jsonl': '' });
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts lines of the wrong shape as bad, never throws', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-01T02:00:00+02:00","job":"a","status":"maybe","owner":"x"}',
        '{"at":"2026-01-01T03:00:00+02:00","job":"a","status":"ok"}',
        '[1,2]',
        'null',
        '',
      ].join('\n'),
    });
    expect(readNight(dir, '2026-01-01')).toEqual({
      rows: [
        {
          job: 'a',
          owner: 'x',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-01-01T01:00:00+02:00',
          lastAt: '2026-01-01T01:00:00+02:00',
        },
      ],
      badLines: 4,
    });
  });
});
