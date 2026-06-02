import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readState, writeState } from '../src/store.js';

function fakeFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFile: async (path) => {
      if (!(path in files)) {
        const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
        err.code = 'ENOENT';
        throw err;
      }
      return files[path];
    },
    writeFile: async (path, content) => { files[path] = content; }
  };
}

test('readState returns null when file is missing', async () => {
  const fs = fakeFs();
  const r = await readState({ path: 'totals.json', readFile: fs.readFile });
  assert.equal(r, null);
});

test('readState returns null for empty file', async () => {
  const fs = fakeFs({ 'totals.json': '' });
  const r = await readState({ path: 'totals.json', readFile: fs.readFile });
  assert.equal(r, null);
});

test('readState parses valid JSON', async () => {
  const fs = fakeFs({ 'totals.json': JSON.stringify({ schema: 1, views: { '2026-05-20': { count: 1, uniques: 1 } }, clones: {} }) });
  const r = await readState({ path: 'totals.json', readFile: fs.readFile });
  assert.equal(r.schema, 1);
  assert.equal(r.views['2026-05-20'].count, 1);
});

test('readState throws on invalid JSON with a clear message', async () => {
  const fs = fakeFs({ 'totals.json': 'not json' });
  await assert.rejects(readState({ path: 'totals.json', readFile: fs.readFile }), /invalid JSON/);
});

test('readState propagates non-ENOENT read errors', async () => {
  const readFile = async () => {
    const e = new Error('EACCES');
    e.code = 'EACCES';
    throw e;
  };
  await assert.rejects(readState({ path: 'totals.json', readFile }), /EACCES/);
});

test('writeState serialises with trailing newline', async () => {
  const fs = fakeFs();
  await writeState({ path: 'totals.json', writeFile: fs.writeFile, state: { schema: 1, views: {}, clones: {} } });
  const content = fs.files['totals.json'];
  assert.ok(content.endsWith('\n'));
  assert.deepEqual(JSON.parse(content), { schema: 1, views: {}, clones: {} });
});

test('readState requires path and readFile', async () => {
  await assert.rejects(readState({ readFile: async () => '' }), /path/);
  await assert.rejects(readState({ path: 'x' }), /readFile/);
});

test('writeState requires path and writeFile', async () => {
  await assert.rejects(writeState({ writeFile: async () => {}, state: {} }), /path/);
  await assert.rejects(writeState({ path: 'x', state: {} }), /writeFile/);
});

test('round-trip: written state can be read back', async () => {
  const fs = fakeFs();
  const original = { schema: 1, updatedAt: '2026-06-02T03:00:00Z', views: { '2026-05-20': { count: 12, uniques: 4 } }, clones: {} };
  await writeState({ path: 'totals.json', writeFile: fs.writeFile, state: original });
  const back = await readState({ path: 'totals.json', readFile: fs.readFile });
  assert.deepEqual(back, original);
});
