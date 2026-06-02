import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, _internals } from '../src/options.js';

const { DEFAULTS } = _internals;

test('defaults applied when no input given', () => {
  const { options, warnings } = parseOptions();
  assert.equal(options.metric, 'views');
  assert.equal(options.color, 'blue');
  assert.equal(options.label, 'Repo views');
  assert.equal(options.fontSize, 11);
  assert.equal(options.style, 'flat');
  assert.equal(options.abbreviated, false);
  assert.equal(options.base, 0);
  assert.equal(options.output, 'badge.svg');
  assert.deepEqual(options.repos, []);
  assert.deepEqual(warnings, []);
});

test('defaults applied for empty-string inputs', () => {
  const { options, warnings } = parseOptions({
    metric: '', color: '', label: '', 'font-size': '', style: '',
    abbreviated: '', base: '', output: '', repos: ''
  });
  assert.equal(options.metric, DEFAULTS.metric);
  assert.equal(options.color, DEFAULTS.color);
  assert.equal(options.fontSize, DEFAULTS.fontSize);
  assert.deepEqual(warnings, []);
});

test('valid metrics accepted', () => {
  for (const m of ['views', 'clones', 'views-unique', 'clones-unique']) {
    const { options, warnings } = parseOptions({ metric: m });
    assert.equal(options.metric, m);
    assert.deepEqual(warnings, []);
  }
});

test('invalid metric falls back with warning, never throws', () => {
  const { options, warnings } = parseOptions({ metric: 'pageviews' });
  assert.equal(options.metric, DEFAULTS.metric);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /metric/i);
});

test('named colors accepted (case-insensitive)', () => {
  const { options, warnings } = parseOptions({ color: 'BrightGreen' });
  assert.equal(options.color, 'brightgreen');
  assert.deepEqual(warnings, []);
});

test('valid hex color accepted (no #, lowercased)', () => {
  const { options, warnings } = parseOptions({ color: 'AABBCC' });
  assert.equal(options.color, 'aabbcc');
  assert.deepEqual(warnings, []);
});

test('invalid color (with #) falls back with warning', () => {
  const { options, warnings } = parseOptions({ color: '#aabbcc' });
  assert.equal(options.color, DEFAULTS.color);
  assert.equal(warnings.length, 1);
});

test('invalid hex color falls back with warning', () => {
  const { options, warnings } = parseOptions({ color: 'ZZZZZZ' });
  assert.equal(options.color, DEFAULTS.color);
  assert.match(warnings[0], /color/i);
});

test('label passed through verbatim (preserves whitespace and casing)', () => {
  const { options } = parseOptions({ label: 'My Custom Label' });
  assert.equal(options.label, 'My Custom Label');
});

test('font-size accepts string and number', () => {
  assert.equal(parseOptions({ 'font-size': '14' }).options.fontSize, 14);
  assert.equal(parseOptions({ fontSize: 14 }).options.fontSize, 14);
});

test('font-size out of range is clamped with warning', () => {
  const high = parseOptions({ 'font-size': '99' });
  assert.equal(high.options.fontSize, 24);
  assert.match(high.warnings[0], /font-size/i);

  const low = parseOptions({ 'font-size': '2' });
  assert.equal(low.options.fontSize, 8);
  assert.match(low.warnings[0], /font-size/i);
});

test('non-integer font-size falls back with warning', () => {
  const { options, warnings } = parseOptions({ 'font-size': 'big' });
  assert.equal(options.fontSize, DEFAULTS.fontSize);
  assert.equal(warnings.length, 1);
});

test('valid styles accepted', () => {
  for (const s of ['flat', 'flat-square', 'plastic', 'for-the-badge']) {
    assert.equal(parseOptions({ style: s }).options.style, s);
  }
});

test('invalid style falls back with warning', () => {
  const { options, warnings } = parseOptions({ style: 'fancy' });
  assert.equal(options.style, DEFAULTS.style);
  assert.match(warnings[0], /style/i);
});

test('abbreviated parses boolean and string', () => {
  assert.equal(parseOptions({ abbreviated: true }).options.abbreviated, true);
  assert.equal(parseOptions({ abbreviated: 'true' }).options.abbreviated, true);
  assert.equal(parseOptions({ abbreviated: 'FALSE' }).options.abbreviated, false);
});

test('invalid abbreviated falls back with warning', () => {
  const { options, warnings } = parseOptions({ abbreviated: 'maybe' });
  assert.equal(options.abbreviated, false);
  assert.equal(warnings.length, 1);
});

test('base accepts non-negative integers', () => {
  assert.equal(parseOptions({ base: '1234' }).options.base, 1234);
  assert.equal(parseOptions({ base: 0 }).options.base, 0);
});

test('negative or non-integer base falls back with warning', () => {
  assert.equal(parseOptions({ base: '-5' }).options.base, 0);
  assert.equal(parseOptions({ base: '1.5' }).options.base, 0);
  assert.equal(parseOptions({ base: 'abc' }).options.base, 0);
});

test('repos parses comma/space separated list', () => {
  assert.deepEqual(parseOptions({ repos: 'a/b, c/d e/f' }).options.repos, ['a/b', 'c/d', 'e/f']);
});

test('repos accepts "all" keyword', () => {
  assert.equal(parseOptions({ repos: 'all' }).options.repos, 'all');
});

test('repos accepts array input', () => {
  assert.deepEqual(parseOptions({ repos: ['x/y', 'z/w'] }).options.repos, ['x/y', 'z/w']);
});

test('output and token passed through', () => {
  const { options } = parseOptions({ output: 'my.svg', token: 'ghp_xxx' });
  assert.equal(options.output, 'my.svg');
  assert.equal(options.token, 'ghp_xxx');
});

test('parseOptions never throws on garbage input', () => {
  assert.doesNotThrow(() => parseOptions({
    metric: 42, color: {}, 'font-size': null, style: [], abbreviated: 'huh', base: NaN
  }));
});
