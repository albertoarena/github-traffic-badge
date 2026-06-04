import { _internals as optionsInternals } from './options.js';

const { NAMED_COLORS } = optionsInternals;
const DEFAULT_COLOR = 'blue';
const LABEL_BG = '#555';
const TEXT_COLOR = '#fff';
const SHADOW = '#010101';

const HEX_RE = /^[0-9a-fA-F]{6}$/;
const CHAR_WIDTH_RATIO = 0.6;
const SIDE_PADDING = 6;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveColor(color) {
  if (typeof color === 'string') {
    const lower = color.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) {
      return NAMED_COLORS[lower];
    }
    if (HEX_RE.test(color)) {
      return `#${color.toLowerCase()}`;
    }
  }
  return NAMED_COLORS[DEFAULT_COLOR];
}

/**
 * Abbreviate a number into a short, badge-friendly form (K, M, B).
 *
 * Truncates (does not round) so the displayed value never exceeds the actual
 * count. Examples: 999 -> "999", 1000 -> "1K", 12345 -> "12.3K",
 * 1_500_000 -> "1.5M". Non-finite input yields "0".
 *
 * @param {number} n number to abbreviate
 * @returns {string} abbreviated text
 */
export function abbreviate(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs < 1000) return `${sign}${Math.trunc(abs)}`;
  const units = [
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'K' }
  ];
  for (const { v, s } of units) {
    if (abs >= v) {
      const scaled = abs / v;
      const formatted = scaled >= 100
        ? Math.trunc(scaled).toString()
        : (Math.floor(scaled * 10) / 10).toString();
      return `${sign}${formatted}${s}`;
    }
  }
  return `${sign}${Math.trunc(abs)}`;
}

function textWidth(text, fontSize) {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

function styleGeometry(style, fontSize) {
  switch (style) {
    case 'flat-square':
      return { height: Math.max(20, fontSize + 9), radius: 0, gradient: false };
    case 'plastic':
      return { height: Math.max(18, fontSize + 7), radius: 4, gradient: true };
    case 'for-the-badge':
      return { height: Math.max(28, fontSize + 17), radius: 0, gradient: false, uppercase: true, letterSpacing: 1 };
    case 'flat':
    default:
      return { height: Math.max(20, fontSize + 9), radius: 3, gradient: false };
  }
}

/**
 * Render the badge as a standalone SVG string.
 *
 * Pure: same inputs always produce the same output, no I/O. Width scales with
 * `text length * fontSize * 0.6` so longer labels and larger fonts don't
 * overflow the colored value rect. Label and value are XML-escaped.
 * Style branches: flat (default), flat-square (no rounded corners), plastic
 * (adds a gradient overlay), for-the-badge (uppercased, taller, letter-spaced).
 *
 * @param {number} total integer total produced by accumulator.totalFor
 * @param {Object} options validated options object from options.parseOptions
 * @returns {string} a standalone SVG document
 */
export function render(total, options) {
  const fontSize = options.fontSize ?? 11;
  const style = options.style ?? 'flat';
  const geom = styleGeometry(style, fontSize);

  let labelText = options.label ?? '';
  const valueText = options.abbreviated ? abbreviate(total) : String(Math.trunc(Number(total) || 0));
  if (options.lowercase) labelText = labelText.toLowerCase();
  if (geom.uppercase) labelText = labelText.toUpperCase();

  const labelW = Math.ceil(textWidth(labelText, fontSize) + SIDE_PADDING * 2);
  const valueW = Math.ceil(textWidth(valueText, fontSize) + SIDE_PADDING * 2);
  const totalW = labelW + valueW;
  const h = geom.height;
  const r = geom.radius;
  const valueColor = resolveColor(options.color);

  const labelTextX = labelW / 2;
  const valueTextX = labelW + valueW / 2;
  const textY = Math.round(h * 0.7);

  const labelSafe = escapeXml(labelText);
  const valueSafe = escapeXml(valueText);
  const letterSpacing = geom.letterSpacing ? ` letter-spacing="${geom.letterSpacing}"` : '';

  const gradientDef = geom.gradient
    ? `<defs><linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".1" stop-color="#aaa" stop-opacity=".1"/><stop offset=".9" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>`
    : '';

  const gradientOverlay = geom.gradient
    ? `<rect width="${totalW}" height="${h}" rx="${r}" fill="url(#g)"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" role="img" aria-label="${labelSafe}: ${valueSafe}">${gradientDef}<rect width="${totalW}" height="${h}" rx="${r}" fill="${LABEL_BG}"/><rect x="${labelW}" width="${valueW}" height="${h}" rx="${r}" fill="${valueColor}"/>${r > 0 ? `<rect width="${labelW}" height="${h}" rx="${r}" fill="${LABEL_BG}"/>` : ''}${gradientOverlay}<g fill="${TEXT_COLOR}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${fontSize}"${letterSpacing}><text x="${labelTextX}" y="${textY + 1}" fill="${SHADOW}" fill-opacity=".3">${labelSafe}</text><text x="${labelTextX}" y="${textY}">${labelSafe}</text><text x="${valueTextX}" y="${textY + 1}" fill="${SHADOW}" fill-opacity=".3">${valueSafe}</text><text x="${valueTextX}" y="${textY}">${valueSafe}</text></g></svg>`;
}

export const _internals = { NAMED_COLORS, DEFAULT_COLOR, CHAR_WIDTH_RATIO, SIDE_PADDING, escapeXml, resolveColor, textWidth, styleGeometry };
