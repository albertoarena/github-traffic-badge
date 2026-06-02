const SCHEMA_VERSION = 1;

const METRIC_TO_BUCKET = {
  'views': { bucket: 'views', field: 'count' },
  'clones': { bucket: 'clones', field: 'count' },
  'views-unique': { bucket: 'views', field: 'uniques' },
  'clones-unique': { bucket: 'clones', field: 'uniques' }
};

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

export function mergeTraffic(existing, fresh, { now } = {}) {
  const next = normalizeState(existing);
  const safeFresh = fresh && typeof fresh === 'object' ? fresh : {};
  upsertBucket(next.views, safeFresh.views);
  upsertBucket(next.clones, safeFresh.clones);
  next.updatedAt = now ?? new Date().toISOString();
  return next;
}

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
