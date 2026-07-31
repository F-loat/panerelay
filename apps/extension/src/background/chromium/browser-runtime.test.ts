import assert from 'node:assert/strict';
import test from 'node:test';
import { chromiumBrowserRuntime } from './browser-runtime.js';

test('detects Chrome and Edge with full CDP and side-panel capability', () => {
  const chromeRuntime = chromiumBrowserRuntime({
    actionAvailable: true,
    debuggerAvailable: true,
    sidePanelAvailable: true,
    platform: 'Linux',
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
  });
  assert.deepEqual(chromeRuntime, {
    actionBadge: true,
    browserFamily: 'chrome',
    browserName: 'Chrome on Linux',
    cdpRelay: true,
    chromiumSidePanel: true,
    firefoxSidebar: false,
  });

  const edgeRuntime = chromiumBrowserRuntime({
    actionAvailable: true,
    debuggerAvailable: true,
    sidePanelAvailable: true,
    platform: 'Windows',
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  });
  assert.equal(edgeRuntime.browserFamily, 'edge');
  assert.equal(edgeRuntime.browserName, 'Microsoft Edge on Windows');
  assert.equal(edgeRuntime.cdpRelay, true);
});
