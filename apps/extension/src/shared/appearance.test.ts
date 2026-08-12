import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accentPalette,
  colorContrastRatio,
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
  websiteAccentPalette,
} from './appearance.js';

test('normalizes only bounded six-digit hexadecimal accent colors', () => {
  assert.equal(normalizeAccentColor(' #A1B2C3 '), '#a1b2c3');
  assert.equal(normalizeAccentColor('#abc'), null);
  assert.equal(normalizeAccentColor('red'), null);
  assert.equal(normalizeAccentColor('#112233; color: red'), null);
  assert.equal(normalizeAccentColor(null), null);
});

test('keeps an already readable accent and derives its supporting roles', () => {
  const palette = accentPalette(DEFAULT_ACCENT_COLOR, 'dark');
  assert.equal(palette.color, DEFAULT_ACCENT_COLOR);
  assert.equal(palette.contrast, '#06150d');
  assert.match(palette.hover, /^#[\da-f]{6}$/);
  assert.match(palette.soft, /^rgb\(\d+ \d+ \d+ \/ 14%\)$/);
});

test('adjusts extreme colors until they remain readable on each theme surface', () => {
  const lightPalette = accentPalette('#ffffff', 'light');
  const darkPalette = accentPalette('#000000', 'dark');

  assert.ok(colorContrastRatio(lightPalette.color, '#ffffff') >= 4.5);
  assert.ok(colorContrastRatio(darkPalette.color, '#111313') >= 4.5);
  assert.ok(colorContrastRatio(lightPalette.color, lightPalette.contrast) >= 4.5);
  assert.ok(colorContrastRatio(darkPalette.color, darkPalette.contrast) >= 4.5);
});

test('falls back safely when the stored accent is invalid', () => {
  assert.deepEqual(accentPalette('not-css', 'dark'), accentPalette(DEFAULT_ACCENT_COLOR, 'dark'));
});

test('derives a bounded website palette from the contrast-safe dark accent', () => {
  for (const accent of [DEFAULT_ACCENT_COLOR, '#000000', '#ffffff', '#336699', 'not-css']) {
    const palette = websiteAccentPalette(accent);
    assert.match(palette.primary, /^#[\da-f]{6}$/);
    assert.match(palette.soft, /^#[\da-f]{6}$/);
    assert.match(palette.dark, /^#[\da-f]{6}$/);
    assert.ok(colorContrastRatio(palette.primary, '#080b0a') >= 4.5);
    assert.ok(colorContrastRatio(palette.soft, palette.dark) >= 4.5);
  }
});
