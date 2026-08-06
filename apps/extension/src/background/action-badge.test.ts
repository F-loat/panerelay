import assert from 'node:assert/strict';
import test from 'node:test';
import { controlBadgeBackground, controlBadgeText } from './action-badge.js';

test('shows the controlled tab count and hides an idle badge', () => {
  assert.equal(controlBadgeText(0), '');
  assert.equal(controlBadgeText(1), '1');
  assert.equal(controlBadgeText(12), '12');
  assert.equal(controlBadgeText(99), '99');
  assert.equal(controlBadgeText(100), '99+');
});

test('derives the badge background from the bounded accent preference', () => {
  assert.equal(controlBadgeBackground('#336699'), '#5680ab');
  assert.equal(controlBadgeBackground('invalid'), controlBadgeBackground('#35d07f'));
});
