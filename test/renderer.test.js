import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, abbreviate, _internals } from '../src/renderer.js';

function defaults(overrides = {}) {
  return {
    metric: 'views',
    color: 'blue',
    label: 'Repo views',
    fontSize: 11,
    style: 'flat',
    abbreviated: false,
    base: 0,
    output: 'badge.svg',
    ...overrides
  };
}

test('produces valid standalone <svg> markup', () => {
  const svg = render(123, defaults());
  assert.match(svg, /^<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
});

test('named color resolves to its hex value', () => {
  const svg = render(1, defaults({ color: 'brightgreen' }));
  assert.match(svg, /#4c1/i);
});

test('valid hex color (no #) is used directly', () => {
  const svg = render(1, defaults({ color: 'aabbcc' }));
  assert.match(svg, /#aabbcc/);
});

test('unknown color falls back to the default named color', () => {
  const svg = render(1, defaults({ color: 'not-a-color' }));
  const fallback = _internals.NAMED_COLORS[_internals.DEFAULT_COLOR];
  assert.ok(svg.includes(fallback), `expected fallback ${fallback} in svg`);
});

test('label override appears in the rendered SVG', () => {
  const svg = render(0, defaults({ label: 'My Label' }));
  assert.ok(svg.includes('My Label'));
});

test('label is XML-escaped', () => {
  const svg = render(0, defaults({ label: 'A & B <c>' }));
  assert.ok(svg.includes('A &amp; B &lt;c&gt;'));
  assert.ok(!svg.includes('A & B <c>'));
});

test('font-size changes the text size attribute', () => {
  const svg = render(100, defaults({ fontSize: 11 }));
  const big = render(100, defaults({ fontSize: 20 }));
  assert.match(svg, /font-size="11"/);
  assert.match(big, /font-size="20"/);
});

test('font-size affects the overall badge width', () => {
  const small = render(12345, defaults({ fontSize: 11 }));
  const large = render(12345, defaults({ fontSize: 20 }));
  const wSmall = parseFloat(small.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  const wLarge = parseFloat(large.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  assert.ok(wLarge > wSmall, `expected ${wLarge} > ${wSmall}`);
});

test('longer label produces a wider badge', () => {
  const short = render(1, defaults({ label: 'a' }));
  const long = render(1, defaults({ label: 'a much longer label indeed' }));
  const wShort = parseFloat(short.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  const wLong = parseFloat(long.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  assert.ok(wLong > wShort);
});

test('every style renders without throwing and produces valid svg', () => {
  for (const style of ['flat', 'flat-square', 'plastic', 'for-the-badge']) {
    const svg = render(100, defaults({ style }));
    assert.match(svg, /^<svg\b/, `style ${style} should produce svg`);
    assert.match(svg, /<\/svg>$/);
  }
});

test('for-the-badge style uppercases the label', () => {
  const svg = render(1, defaults({ style: 'for-the-badge', label: 'Repo Views' }));
  assert.ok(svg.includes('REPO VIEWS'));
});

test('lowercase off (default): label rendered with original casing', () => {
  const svg = render(1, defaults({ label: 'Repo Views' }));
  assert.ok(svg.includes('Repo Views'));
  assert.ok(!svg.includes('repo views'));
});

test('lowercase on: label is rendered lowercase', () => {
  const svg = render(1, defaults({ label: 'Repo Views', lowercase: true }));
  assert.ok(svg.includes('repo views'));
  assert.ok(!svg.includes('Repo Views'));
});

test('lowercase preserves non-letter characters and whitespace', () => {
  const svg = render(1, defaults({ label: 'My-Repo  V1', lowercase: true }));
  assert.ok(svg.includes('my-repo  v1'));
});

test('for-the-badge still uppercases even when lowercase is true', () => {
  // for-the-badge is inherently uppercase per shields.io convention; the style
  // wins over the lowercase flag.
  const svg = render(1, defaults({ style: 'for-the-badge', label: 'Repo Views', lowercase: true }));
  assert.ok(svg.includes('REPO VIEWS'));
});

test('flat-square style uses no corner radius', () => {
  const svg = render(1, defaults({ style: 'flat-square' }));
  assert.ok(!/\brx="[1-9]/.test(svg), 'flat-square should not have rounded corners');
});

test('plastic style includes a gradient', () => {
  const svg = render(1, defaults({ style: 'plastic' }));
  assert.match(svg, /<linearGradient\b/);
});

test('zero state renders "0"', () => {
  const svg = render(0, defaults());
  assert.ok(svg.includes('>0<'));
});

test('abbreviation off: full number is shown', () => {
  const svg = render(12345, defaults({ abbreviated: false }));
  assert.ok(svg.includes('12345'));
});

test('abbreviation on: number is shortened', () => {
  const svg = render(12345, defaults({ abbreviated: true }));
  assert.ok(svg.includes('12.3K'));
  assert.ok(!svg.includes('12345'));
});

test('abbreviate thresholds', () => {
  assert.equal(abbreviate(0), '0');
  assert.equal(abbreviate(1), '1');
  assert.equal(abbreviate(999), '999');
  assert.equal(abbreviate(1000), '1K');
  assert.equal(abbreviate(1500), '1.5K');
  assert.equal(abbreviate(12345), '12.3K');
  assert.equal(abbreviate(999999), '999K');
  assert.equal(abbreviate(1000000), '1M');
  assert.equal(abbreviate(1500000), '1.5M');
  assert.equal(abbreviate(1234567890), '1.2B');
});

test('abbreviate handles negatives by treating as positive magnitude', () => {
  assert.equal(abbreviate(-1500), '-1.5K');
});

test('total is XML-escaped in case of weird inputs', () => {
  const svg = render(42, defaults());
  assert.ok(!svg.includes('<42<'));
  assert.ok(svg.includes('>42<'));
});

test('textWidth accounts for letter-spacing between characters', () => {
  const without = _internals.textWidth('hello', 11, 0);
  const withSpacing = _internals.textWidth('hello', 11, 1);
  // 5 chars => 4 gaps, each gap adds 1px at letterSpacing=1.
  assert.equal(withSpacing - without, 4);
});

test('textWidth with letterSpacing defaults to 0 (backwards compatible)', () => {
  assert.equal(_internals.textWidth('abc', 11), _internals.textWidth('abc', 11, 0));
});

test('for-the-badge style widens the badge to account for letter-spacing', () => {
  // Same font-size and same label length (uppercased) and same value length.
  // The only width difference between flat and for-the-badge here is the
  // letter-spacing="1" the latter applies. Expected extra width:
  //   labelGaps + valueGaps = (10-1) + (3-1) = 11px.
  const label = 'Repo Views';
  const flat = render(123, defaults({ style: 'flat', label, fontSize: 11 }));
  const ftb = render(123, defaults({ style: 'for-the-badge', label, fontSize: 11 }));
  const wFlat = parseFloat(flat.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  const wFtb = parseFloat(ftb.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]);
  assert.ok(
    wFtb >= wFlat + 11,
    `expected for-the-badge width ${wFtb} >= flat width ${wFlat} + 11 (letter-spacing)`
  );
});

test('rendered SVG includes both label and value text nodes', () => {
  const svg = render(7, defaults({ label: 'Hits' }));
  const matches = svg.match(/<text\b/g) || [];
  assert.ok(matches.length >= 2, 'expected at least two <text> elements');
  assert.ok(svg.includes('Hits'));
  assert.ok(svg.includes('>7<'));
});
