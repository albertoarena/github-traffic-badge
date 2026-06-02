const SCHEMA_VERSION = 1;

const METRIC_TO_BUCKET = {
  'views': { bucket: 'views', field: 'count' },
  'clones': { bucket: 'clones', field: 'count' },
  'views-unique': { bucket: 'views', field: 'uniques' },
  'clones-unique': { bucket: 'clones', field: 'uniques' }
};

/**
 * Build an empty persisted state with the current schema version.
 *
 * @returns {{ schema: number, updatedAt: null, views: Object, clones: Object }}
 */
export function emptyState() {
  return { schema: SCHEMA_VERSION, updatedAt: null, views: {}, clones: {} };
}

function normalizeState(s) {
  if (!s || typeof s !== 'object') return emptyState();
  return {
    schema: SCHEMA_VERSION,
    updatedAt: s.updatedAt ?? null,
    views: { ...(s.views || {}) },
    clones: { ...(s.clones || {}) }
  };
}

function toInt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return 0;
}

function upsertBucket(bucket, entries) {
  if (!Array.isArray(entries)) return bucket;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const date = typeof entry.date === 'string' ? entry.date.trim() : '';
    if (!date) continue;
    bucket[date] = { count: toInt(entry.count), uniques: toInt(entry.uniques) };
  }
  return bucket;
}

/**
 * Merge fresh Traffic-API data into the persisted state.
 *
 * Core invariant: entries are upserted by date key, never summed. Because the
 * Traffic API always returns the last 14 days, summing would double-count the
 * 13 overlapping days on every daily run. Upserting makes a run on identical
 * input a no-op (idempotency). The total is derived as the sum of the map.
 *
 * Pure and non-mutating: returns a new state object; the input is unchanged.
 * Malformed entries (missing date, non-numeric count/uniques) are skipped or
 * coerced to 0 rather than throwing.
 *
 * @param {Object|null|undefined} existing prior persisted state, or null/undefined
 * @param {{ views?: Array, clones?: Array }} fresh normalised Traffic-API data
 * @param {{ now?: string }} [opts] override the updatedAt timestamp (testing)
 * @returns {Object} new state with merged views/clones and refreshed updatedAt
 */
export function mergeTraffic(existing, fresh, { now } = {}) {
  const next = normalizeState(existing);
  const safeFresh = fresh && typeof fresh === 'object' ? fresh : {};
  upsertBucket(next.views, safeFresh.views);
  upsertBucket(next.clones, safeFresh.clones);
  next.updatedAt = now ?? new Date().toISOString();
  return next;
}

/**
 * Compute the displayed total for the selected metric, plus an optional base.
 *
 * @param {Object} state persisted state produced by mergeTraffic / emptyState
 * @param {'views'|'clones'|'views-unique'|'clones-unique'} metric metric to sum
 * @param {number} [base=0] non-negative integer offset added to the total
 * @returns {number} integer total
 * @throws {Error} if metric is not one of the four supported keys
 */
export function totalFor(state, metric, base = 0) {
  const mapping = METRIC_TO_BUCKET[metric];
  if (!mapping) throw new Error(`Unknown metric: ${metric}`);
  const bucket = (state && state[mapping.bucket]) || {};
  let total = 0;
  for (const key of Object.keys(bucket)) {
    const entry = bucket[key];
    if (entry) total += toInt(entry[mapping.field]);
  }
  return total + toInt(base);
}

export const _internals = { SCHEMA_VERSION, METRIC_TO_BUCKET };
