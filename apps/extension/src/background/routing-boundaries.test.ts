import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('registers the actual Chrome runtime Extension ID', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  assert.match(source, /extensionId: chrome\.runtime\.id/);
});

test('keeps target-scoped automation failures out of the global error banner', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('async function handleTargetRequest'),
    source.indexOf('async function attachTarget'),
  );
  const attachHandler = source.slice(
    source.indexOf('async function attachTarget'),
    source.indexOf('async function runCdpCommand'),
  );

  assert.match(targetRequestHandler, /sendTargetResult\(message\.requestId, \{ success: false/);
  assert.match(attachHandler, /type: 'cdp\.attached'/);
  assert.match(attachHandler, /success: false/);
  assert.doesNotMatch(targetRequestHandler, /lastError\s*=/);
  assert.doesNotMatch(attachHandler, /lastError\s*=/);
});

test('marks the current document on Agent commands without persisting across navigation', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const attachHandler = source.slice(
    source.indexOf('async function attachTarget'),
    source.indexOf('async function runCdpCommand'),
  );
  const commandHandler = source.slice(
    source.indexOf('async function runCdpCommand'),
    source.indexOf('async function detachTarget'),
  );
  const tabUpdatedHandler = source.slice(
    source.indexOf('chrome.tabs.onUpdated.addListener'),
    source.indexOf('chrome.permissions.onRemoved.addListener'),
  );

  assert.ok(
    commandHandler.indexOf('cdpCommandTouchesDocument(message.method)') <
      commandHandler.indexOf('await applyControlledFavicon(current.id)') &&
      commandHandler.indexOf('await applyControlledFavicon(current.id)') <
        commandHandler.indexOf('await chrome.debugger.sendCommand'),
  );
  assert.doesNotMatch(attachHandler, /applyControlledFavicon/);
  assert.doesNotMatch(tabUpdatedHandler, /applyControlledFavicon/);
});

test('turns target creation authorization failures into Extension guidance', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('async function handleTargetRequest'),
    source.indexOf('async function attachTarget'),
  );

  assert.match(targetRequestHandler, /authorizationRequest = 'all-tabs'/);
  assert.match(
    targetRequestHandler,
    /Open the Panerelay Chrome Extension, authorize all tabs, then retry/,
  );
  assert.ok(
    targetRequestHandler.indexOf("authorizationRequest = 'all-tabs'") <
      targetRequestHandler.indexOf('chrome.tabs.create'),
  );
});

test('keeps Agent-created and selected targets in the background', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('async function handleTargetRequest'),
    source.indexOf('async function attachTarget'),
  );

  assert.match(targetRequestHandler, /chrome\.tabs\.create\(\{ url, active: false \}\)/);
  assert.doesNotMatch(targetRequestHandler, /chrome\.tabs\.update/);
  assert.doesNotMatch(targetRequestHandler, /chrome\.windows\.update/);
  assert.match(
    targetRequestHandler,
    /case 'activate':[\s\S]*targetInfo\(await tabForTarget\(message\.operation\.targetId\)\)/,
  );
});

test('validates controlled-tab membership before activating or closing a Chrome tab', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const controlledActions = source.slice(
    source.indexOf('function controlledTargetIdForTab'),
    source.indexOf('async function handleSidePanelRequest'),
  );

  assert.match(controlledActions, /controlledTabs\.has\(targetId\)/);
  assert.ok(
    controlledActions.indexOf('controlledTargetIdForTab(tabId)') <
      controlledActions.indexOf('chrome.tabs.update'),
  );
  assert.ok(
    controlledActions.lastIndexOf('controlledTargetIdForTab(tabId)') <
      controlledActions.indexOf('chrome.tabs.remove'),
  );
});

test('injects and coordinates page comments across authorized reachable frames', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const pageCommentSetup = source.slice(
    source.indexOf('const pageCommentService'),
    source.indexOf('async function updateActionBadge'),
  );
  const runtimeRouter = source.slice(
    source.indexOf('chrome.runtime.onMessage.addListener'),
    source.indexOf('chrome.debugger.onEvent.addListener'),
  );

  assert.match(pageCommentSetup, /target: \{ tabId, allFrames: true \}/);
  assert.match(runtimeRouter, /panerelay\.page-comment\.frame-active/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.frame-active/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.pause/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.resume/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.stop/);
  assert.doesNotMatch(runtimeRouter, /sender\.frameId/);
});
