import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

const line = (job: string, status = 'ok') =>
  JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status, owner: 'lane-07' });

// Jobs are written out of order on purpose: both routes must sort by job.
beforeAll(() => {
  fs.writeFileSync(
    path.join(runsDir, '2026-01-01.jsonl'),
    [line('zeta/job'), line('alpha/job'), line('mid/job', 'retry')].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(path.join(runsDir, '2026-01-03.jsonl'), [line('alpha/job'), 'not json'].join('\n') + '\n');
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

const get = (url: string) => createApp(config).request(url);

describe('digest routes', () => {
  it('serves a night with data, page and JSON in the same job order', async () => {
    const page = await get('/digest/2026-01-01');
    const json = await get('/api/digest/2026-01-01');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);

    const body = (await json.json()) as { night: string; rows: { job: string }[]; badLines: number };
    const jobs = body.rows.map((r) => r.job);
    expect(body.night).toBe('2026-01-01');
    expect(jobs).toEqual(['alpha/job', 'mid/job', 'zeta/job']);

    const html = await page.text();
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('returns 404 for a night with no file', async () => {
    expect((await get('/digest/2026-02-02')).status).toBe(404);
    expect((await get('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('returns 404 for an invalid night', async () => {
    expect((await get('/digest/..%2Fetc')).status).toBe(404);
    expect((await get('/api/digest/..%2Fetc')).status).toBe(404);
  });

  it('shows "nothing ran" and empty rows for an empty night', async () => {
    const page = await get('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');

    const json = await get('/api/digest/2026-01-02');
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('still renders a night with a bad line and counts it', async () => {
    const page = await get('/digest/2026-01-03');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('alpha/job');

    const json = await get('/api/digest/2026-01-03');
    expect(json.status).toBe(200);
    const body = (await json.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job']);
  });
});
