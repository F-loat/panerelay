import assert from 'node:assert/strict';
import test from 'node:test';
import { isPanerelaySetupFailure } from './setup-guidance.js';

test('recognizes bounded Panerelay Provider/plugin readiness failures', () => {
  assert.equal(isPanerelaySetupFailure("Plugin 'panerelay' returned success=false"), true);
  assert.equal(isPanerelaySetupFailure('Provider panerelay was not installed'), true);
  assert.equal(isPanerelaySetupFailure('Failed to load plugin "panerelay"'), true);
});

test('does not reinterpret generic or unrelated plugin failures', () => {
  assert.equal(isPanerelaySetupFailure('Plugin qoder returned success=false'), false);
  assert.equal(isPanerelaySetupFailure('Request returned success=false'), false);
  assert.equal(isPanerelaySetupFailure('Panerelay request timed out'), false);
});
