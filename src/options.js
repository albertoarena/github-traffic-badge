const VALID_METRICS = ['views', 'clones', 'views-unique', 'clones-unique'];
const VALID_STYLES = ['flat', 'flat-square', 'plastic', 'for-the-badge'];
const NAMED_COLORS = {
  blue: '#007ec6',
  green: '#97ca00',
  brightgreen: '#4c1',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
  grey: '#555',
  lightgrey: '#9f9f9f',
  blueviolet: '#8a2be2'
};

const HEX_RE = /^[0-9a-fA-F]{6}$/;

const DEFAULTS = Object.freeze({
  metric: 'views',
  color: 'blue',
  label: 'Repo views',
  fontSize: 11,
  style: 'flat',
  abbreviated: false,
  base: 0,
  output: 'badge.svg',
  token: '',
  repos: []
});

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 24;

function parseBool(raw) {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function parseInteger(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return parseInt(trimmed, 10);
}

function isPresent(v) {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

function parseRepos(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  if (typeof raw !== 'string') return [];
  const t = raw.trim();
  if (!t) return [];
  if (t.toLowerCase() === 'all') return 'all';
  return t.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parse and validate raw action inputs into a typed options object.
 *
 * Pure: never throws, never performs I/O. Unknown or malformed inputs fall back
 * to defaults and produce a warning string in the returned `warnings` array, so
 * the caller (the impure index module) can decide how to surface them.
 *
 * Recognised input keys (all optional, mirror `action.yml`):
 *   - `metric`: views | clones | views-unique | clones-unique
 *   - `color`: named color (blue, green, brightgreen, yellow, orange, red,
 *     grey, lightgrey, blueviolet) or 6-char hex without `#`
 *   - `label`: left-side text
 *   - `font-size` | `fontSize`: integer clamped to [8, 24]
 *   - `style`: flat | flat-square | plastic | for-the-badge
 *   - `abbreviated`: boolean or "true"/"false"
 *   - `base`: non-negative integer added to the displayed total
 *   - `output`: badge filename
 *   - `token`: GitHub token (passed through verbatim)
 *   - `repos`: comma/space separated owner/repo list, array, or "all"
 *
 * @param {Record<string, unknown>} [input] raw input object (typically from env)
 * @returns {{ options: Object, warnings: string[] }} validated options and warnings
 */
export function parseOptions(input = {}) {
  const warnings = [];
  const opts = { ...DEFAULTS };

  if (isPresent(input.metric)) {
    const m = String(input.metric).trim().toLowerCase();
    if (VALID_METRICS.includes(m)) {
      opts.metric = m;
    } else {
      warnings.push(`Invalid metric "${input.metric}", falling back to "${DEFAULTS.metric}".`);
    }
  }

  if (isPresent(input.color)) {
    const c = String(input.color).trim();
    const lower = c.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) {
      opts.color = lower;
    } else if (HEX_RE.test(c)) {
      opts.color = c.toLowerCase();
    } else {
      warnings.push(`Invalid color "${input.color}", falling back to "${DEFAULTS.color}".`);
    }
  }

  if (isPresent(input.label)) {
    opts.label = String(input.label);
  }

  if (isPresent(input['font-size']) || isPresent(input.fontSize)) {
    const raw = isPresent(input['font-size']) ? input['font-size'] : input.fontSize;
    const n = parseInteger(raw);
    if (n === null) {
      warnings.push(`Invalid font-size "${raw}", falling back to ${DEFAULTS.fontSize}.`);
    } else if (n < FONT_SIZE_MIN || n > FONT_SIZE_MAX) {
      const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n));
      warnings.push(`font-size ${n} out of range [${FONT_SIZE_MIN}, ${FONT_SIZE_MAX}], clamped to ${clamped}.`);
      opts.fontSize = clamped;
    } else {
      opts.fontSize = n;
    }
  }

  if (isPresent(input.style)) {
    const s = String(input.style).trim().toLowerCase();
    if (VALID_STYLES.includes(s)) {
      opts.style = s;
    } else {
      warnings.push(`Invalid style "${input.style}", falling back to "${DEFAULTS.style}".`);
    }
  }

  if (isPresent(input.abbreviated)) {
    const b = parseBool(input.abbreviated);
    if (b === null) {
      warnings.push(`Invalid abbreviated "${input.abbreviated}", falling back to ${DEFAULTS.abbreviated}.`);
    } else {
      opts.abbreviated = b;
    }
  }

  if (isPresent(input.base)) {
    const n = parseInteger(input.base);
    if (n === null || n < 0) {
      warnings.push(`Invalid base "${input.base}", falling back to ${DEFAULTS.base}.`);
    } else {
      opts.base = n;
    }
  }

  if (isPresent(input.output)) {
    opts.output = String(input.output).trim();
  }

  if (isPresent(input.token)) {
    opts.token = String(input.token);
  }

  if (isPresent(input.repos)) {
    opts.repos = parseRepos(input.repos);
  }

  return { options: opts, warnings };
}

export const _internals = {
  VALID_METRICS,
  VALID_STYLES,
  NAMED_COLORS,
  DEFAULTS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX
};
