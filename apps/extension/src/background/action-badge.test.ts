import assert from 'node:assert/strict';
import test from 'node:test';
import { controlBadgeColors, controlBadgeText } from './action-badge.js';

test('shows the controlled tab count and hides an idle badge', () => {
  assert.equal(controlBadgeText(0), '');
  assert.equal(controlBadgeText(1), '1');
  assert.equal(controlBadgeText(12), '12');
  assert.equal(controlBadgeText(99), '99');
  assert.equal(controlBadgeText(100), '99+');
});

test('derives readable badge colors from the bounded accent preference', () => {
  assert.deepEqual(controlBadgeColors('#336699'), {
    background: '#5680ab',
    text: '#06150d',
  });
  assert.deepEqual(controlBadgeColors('invalid'), controlBadgeColors('#35d07f'));
});
