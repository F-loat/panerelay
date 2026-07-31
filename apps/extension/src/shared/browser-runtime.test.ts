import assert from 'node:assert/strict';
import test from 'node:test';
import { detectBrowserRuntime } from './browser-runtime.js';

test('detects Chrome and Edge with feature-detected CDP support', () => {
  assert.deepEqual(
    detectBrowserRuntime({
      debuggerAvailable: true,
      platform: 'Linux',
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    }),
    {
      browserFamily: 'chrome',
      browserName: 'Chrome on Linux',
      cdpRelay: true,
    },
  );

  assert.deepEqual(
    detectBrowserRuntime({
      debuggerAvailable: true,
      platform: 'Windows',
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    }),
    {
      browserFamily: 'edge',
      browserName: 'Microsoft Edge on Windows',
      cdpRelay: true,
    },
  );
});

test('detects Chromium and does not infer CDP support from its name', () => {
  assert.deepEqual(
    detectBrowserRuntime({
      debuggerAvailable: false,
      platform: 'macOS',
      userAgent: 'Mozilla/5.0 Chromium/140.0.0.0 Safari/537.36',
    }),
    {
      browserFamily: 'chromium',
      browserName: 'Chromium on macOS',
      cdpRelay: false,
    },
  );
});
