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
      commandHandler.indexOf('controlledTabs.set(message.targetId, current)') &&
      commandHandler.indexOf('controlledTabs.set(message.targetId, current)') <
        commandHandler.indexOf('await applyControlledFavicon(current.id)') &&
      commandHandler.indexOf('await applyControlledFavicon(current.id)') <
        commandHandler.indexOf('await chrome.debugger.sendCommand'),
  );
  assert.match(attachHandler, /attachedTabs\.set\(targetId, summary\)/);
  assert.doesNotMatch(attachHandler, /controlledTabs\.set/);
  assert.doesNotMatch(attachHandler, /applyControlledFavicon/);
  assert.doesNotMatch(tabUpdatedHandler, /applyControlledFavicon/);
});

test('releases the single-tab lease when navigation leaves its authorized origin', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const tabUpdatedHandler = source.slice(
    source.indexOf('chrome.tabs.onUpdated.addListener'),
    source.indexOf('chrome.permissions.onRemoved.addListener'),
  );

  assert.ok(
    tabUpdatedHandler.indexOf('const authorizationModeAtUpdate = authorizationMode') <
      tabUpdatedHandler.indexOf("authorizationMode = 'none'"),
  );
  assert.match(tabUpdatedHandler, /if \(authorizationModeAtUpdate === 'single-tab'\)/);
  assert.match(
    tabUpdatedHandler,
    /await releaseControl\('Tab navigated outside its authorized origin', true\)/,
  );
});

test('deduplicates unchanged target metadata before publishing lifecycle events', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const publisher = source.slice(
    source.indexOf('async function publishTargetForTab'),
    source.indexOf('chrome.tabs.onRemoved.addListener'),
  );

  assert.match(publisher, /targetInfoEquals\(previous, target\)/);
  assert.ok(
    publisher.indexOf('targetInfoEquals(previous, target)') <
      publisher.indexOf("type: 'cdp.target.event'"),
  );
  assert.match(publisher, /event: previous \? 'changed' : 'created'/);
});

test('bounds target discovery to the initial inventory and controlled opener relationships', async () => {
  const source = await readFile(join(process.cwd(), 'src/background/index.ts'), 'utf8');
  const targetList = source.slice(
    source.indexOf('async function listEligibleTargets'),
    source.indexOf('function sendTargetResult'),
  );
  const lifecycle = source.slice(
    source.indexOf('async function publishTargetForTab'),
    source.indexOf('chrome.permissions.onRemoved.addListener'),
  );
  const release = source.slice(
    source.indexOf('async function releaseControl'),
    source.indexOf('async function setAuthorization'),
  );

  assert.match(targetList, /targetExposure\.seedEligible/);
  assert.match(targetList, /targetExposure\.has/);
  assert.match(lifecycle, /targetExposure\.has\(summary\.id\)/);
  assert.match(lifecycle, /controlledTabs\.has\(sourceTargetId\)/);
  assert.match(lifecycle, /targetExposure\.exposeRelated/);
  assert.match(lifecycle, /tab\.openerTabId/);
  assert.match(lifecycle, /onCreatedNavigationTarget/);
  assert.match(lifecycle, /targetPublicationQueue\s*\.enqueue/);
  assert.match(release, /targetExposure\.clear\(\)/);
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
