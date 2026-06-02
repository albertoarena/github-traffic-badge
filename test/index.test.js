import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAction } from '../src/index.js';

function makeFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFile: async (path) => {
      if (!(path in files)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
      return files[path];
    },
    writeFile: async (path, content, opts) => {
      if (opts && opts.flag === 'a') {
        files[path] = (files[path] || '') + content;
      } else {
        files[path] = content;
      }
    }
  };
}

function makeFetch(viewsBody, clonesBody) {
  return async (url) => ({
    status: 200, ok: true,
    json: async () => (url.endsWith('/views') ? viewsBody : clonesBody),
    text: async () => ''
  });
}

function silentLog() {
  return { warn: () => {}, log: () => {}, error: () => {} };
}

test('runAction: end-to-end wires fetch → accumulate → render → write', async () => {
  const fs = makeFs();
  const fetch = makeFetch(
    { views: [{ timestamp: '2026-05-20T00:00:00Z', count: 12, uniques: 4 }] },
    { clones: [] }
  );
  const result = await runAction({
    env: { GITHUB_REPOSITORY: 'o/r' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z'
  });
  assert.equal(result.total, 12);
  assert.equal(result.badgePath, 'badge.svg');
  assert.ok(fs.files['badge.svg'].startsWith('<svg'));
  const state = JSON.parse(fs.files['totals.json']);
  assert.deepEqual(state.views['2026-05-20'], { count: 12, uniques: 4 });
});

test('runAction: existing state is merged (overlapping day upserts)', async () => {
  const existing = {
    schema: 1, updatedAt: '2026-06-01T00:00:00Z',
    views: { '2026-05-20': { count: 5, uniques: 2 } },
    clones: {}
  };
  const fs = makeFs({ 'totals.json': JSON.stringify(existing) });
  const fetch = makeFetch(
    { views: [{ timestamp: '2026-05-20T00:00:00Z', count: 15, uniques: 6 }] },
    { clones: [] }
  );
  const result = await runAction({
    env: { GITHUB_REPOSITORY: 'o/r' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z'
  });
  assert.equal(result.total, 15, 'upsert, not 5+15');
});

test('runAction: base is added to total', async () => {
  const fs = makeFs();
  const fetch = makeFetch(
    { views: [{ timestamp: '2026-05-20T00:00:00Z', count: 10, uniques: 3 }] },
    { clones: [] }
  );
  const result = await runAction({
    env: { GITHUB_REPOSITORY: 'o/r', INPUT_BASE: '1000' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z'
  });
  assert.equal(result.total, 1010);
});

test('runAction: writes GITHUB_OUTPUT when present', async () => {
  const fs = makeFs();
  const fetch = makeFetch({ views: [] }, { clones: [] });
  await runAction({
    env: { GITHUB_REPOSITORY: 'o/r', GITHUB_OUTPUT: '/tmp/out' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z'
  });
  assert.match(fs.files['/tmp/out'], /total=0/);
  assert.match(fs.files['/tmp/out'], /badge-path=badge\.svg/);
});

test('runAction: throws clearly when no repository is configured', async () => {
  const fs = makeFs();
  await assert.rejects(
    runAction({
      env: {},
      readFile: fs.readFile, writeFile: fs.writeFile,
      fetch: makeFetch({ views: [] }, { clones: [] }),
      log: silentLog(), now: () => '2026-06-02T03:00:00Z'
    }),
    /no repository/i
  );
});

test('runAction: warns and falls back when repos="all"', async () => {
  const fs = makeFs();
  const warnings = [];
  const log = { warn: m => warnings.push(m), log: () => {}, error: () => {} };
  await runAction({
    env: { GITHUB_REPOSITORY: 'o/r', INPUT_REPOS: 'all' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch: makeFetch({ views: [] }, { clones: [] }),
    log, now: () => '2026-06-02T03:00:00Z'
  });
  assert.ok(warnings.some(w => /multi-repo/i.test(w)));
});

test('runAction: explicit repos input overrides GITHUB_REPOSITORY', async () => {
  const fs = makeFs();
  let seenUrl;
  const fetch = async (url) => {
    seenUrl = url;
    return { status: 200, ok: true, json: async () => ({ views: [], clones: [] }), text: async () => '' };
  };
  await runAction({
    env: { GITHUB_REPOSITORY: 'o/r', INPUT_REPOS: 'other/proj' },
    readFile: fs.readFile, writeFile: fs.writeFile,
    fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z'
  });
  assert.match(seenUrl, /other\/proj/);
});

test('runAction: idempotent on identical fresh data', async () => {
  const fs = makeFs();
  const fetch = makeFetch(
    { views: [{ timestamp: '2026-05-20T00:00:00Z', count: 12, uniques: 4 }] },
    { clones: [] }
  );
  const env = { GITHUB_REPOSITORY: 'o/r' };
  await runAction({ env, readFile: fs.readFile, writeFile: fs.writeFile, fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z' });
  const after1 = fs.files['totals.json'];
  await runAction({ env, readFile: fs.readFile, writeFile: fs.writeFile, fetch, log: silentLog(), now: () => '2026-06-02T03:00:00Z' });
  const after2 = fs.files['totals.json'];
  assert.equal(after1, after2);
});
