import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, mergeTraffic, totalFor } from '../src/accumulator.js';

const NOW = '2026-06-02T03:00:00.000Z';

function fresh(views = [], clones = []) {
  return { views, clones };
}

test('emptyState produces a valid empty state', () => {
  const s = emptyState();
  assert.equal(s.schema, 1);
  assert.deepEqual(s.views, {});
  assert.deepEqual(s.clones, {});
});

test('new days merge in', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 }],
    [{ date: '2026-05-20', count: 2, uniques: 1 }]
  ), { now: NOW });
  assert.deepEqual(s.views, { '2026-05-20': { count: 12, uniques: 4 } });
  assert.deepEqual(s.clones, { '2026-05-20': { count: 2, uniques: 1 } });
  assert.equal(s.updatedAt, NOW);
  assert.equal(s.schema, 1);
});

test('overlapping days are UPSERTED, never summed (core dedup property)', () => {
  let s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 10, uniques: 4 }]
  ), { now: NOW });

  s = mergeTraffic(s, fresh(
    [{ date: '2026-05-20', count: 15, uniques: 6 }]
  ), { now: NOW });

  assert.deepEqual(s.views['2026-05-20'], { count: 15, uniques: 6 },
    'overlapping day must be overwritten with the latest API value, not summed');
});

test('running twice on identical input is a no-op (idempotency)', () => {
  const f = fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 },
     { date: '2026-05-21', count: 8, uniques: 3 }],
    [{ date: '2026-05-20', count: 2, uniques: 1 }]
  );
  const once = mergeTraffic(emptyState(), f, { now: NOW });
  const twice = mergeTraffic(once, f, { now: NOW });
  assert.deepEqual(twice.views, once.views);
  assert.deepEqual(twice.clones, once.clones);
});

test('empty API response leaves state unchanged (except updatedAt)', () => {
  const prior = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 }]
  ), { now: '2026-06-01T00:00:00.000Z' });

  const after = mergeTraffic(prior, fresh([], []), { now: NOW });
  assert.deepEqual(after.views, prior.views);
  assert.deepEqual(after.clones, prior.clones);
  assert.equal(after.updatedAt, NOW);
});

test('out-of-order days are handled correctly', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [
      { date: '2026-05-22', count: 3, uniques: 1 },
      { date: '2026-05-20', count: 12, uniques: 4 },
      { date: '2026-05-21', count: 8, uniques: 3 }
    ]
  ), { now: NOW });

  assert.deepEqual(Object.keys(s.views).sort(),
    ['2026-05-20', '2026-05-21', '2026-05-22']);
  assert.equal(s.views['2026-05-20'].count, 12);
  assert.equal(s.views['2026-05-22'].count, 3);
});

test('mergeTraffic is non-mutating (returns a new state)', () => {
  const prior = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 10, uniques: 4 }]
  ), { now: NOW });
  const snapshot = JSON.parse(JSON.stringify(prior));

  mergeTraffic(prior, fresh(
    [{ date: '2026-05-21', count: 7, uniques: 2 }]
  ), { now: NOW });

  assert.deepEqual(prior, snapshot, 'input state must not be mutated');
});

test('mergeTraffic accepts null/undefined existing state', () => {
  const s = mergeTraffic(null, fresh(
    [{ date: '2026-05-20', count: 5, uniques: 2 }]
  ), { now: NOW });
  assert.equal(s.views['2026-05-20'].count, 5);

  const s2 = mergeTraffic(undefined, fresh(
    [{ date: '2026-05-20', count: 5, uniques: 2 }]
  ), { now: NOW });
  assert.equal(s2.views['2026-05-20'].count, 5);
});

test('totalFor: views = sum of all view counts', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 },
     { date: '2026-05-21', count: 8, uniques: 3 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'views'), 20);
});

test('totalFor: clones = sum of all clone counts', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [],
    [{ date: '2026-05-20', count: 2, uniques: 1 },
     { date: '2026-05-21', count: 3, uniques: 2 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'clones'), 5);
});

test('totalFor: views-unique = sum of view uniques', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 },
     { date: '2026-05-21', count: 8, uniques: 3 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'views-unique'), 7);
});

test('totalFor: clones-unique = sum of clone uniques', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [],
    [{ date: '2026-05-20', count: 2, uniques: 1 },
     { date: '2026-05-21', count: 3, uniques: 2 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'clones-unique'), 3);
});

test('totalFor: base is added to the displayed total', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 12, uniques: 4 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'views', 1000), 1012);
});

test('totalFor on empty state returns 0 (+ base)', () => {
  assert.equal(totalFor(emptyState(), 'views'), 0);
  assert.equal(totalFor(emptyState(), 'clones', 42), 42);
});

test('totalFor rejects unknown metric', () => {
  assert.throws(() => totalFor(emptyState(), 'pageviews'), /metric/i);
});

test('idempotency after overlap-then-update reflects latest value in total', () => {
  let s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 10, uniques: 4 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'views'), 10);

  s = mergeTraffic(s, fresh(
    [{ date: '2026-05-20', count: 15, uniques: 6 }]
  ), { now: NOW });
  assert.equal(totalFor(s, 'views'), 15,
    'after upsert, total must reflect overwritten value not 10+15');
});

test('schema and updatedAt are always present after merge', () => {
  const s = mergeTraffic(emptyState(), fresh(), { now: NOW });
  assert.equal(s.schema, 1);
  assert.equal(s.updatedAt, NOW);
});

test('malformed entries (missing date) are skipped without throwing', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [
      { date: '2026-05-20', count: 12, uniques: 4 },
      { count: 99, uniques: 1 },
      { date: '', count: 7, uniques: 2 }
    ]
  ), { now: NOW });
  assert.deepEqual(Object.keys(s.views), ['2026-05-20']);
});

test('non-numeric count/uniques default to 0', () => {
  const s = mergeTraffic(emptyState(), fresh(
    [{ date: '2026-05-20', count: 'oops', uniques: null }]
  ), { now: NOW });
  assert.deepEqual(s.views['2026-05-20'], { count: 0, uniques: 0 });
});
