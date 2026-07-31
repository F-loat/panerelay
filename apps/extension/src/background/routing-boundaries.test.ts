import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const chromiumBackground = join(process.cwd(), 'src/background/chromium/index.ts');
const chromiumAutomation = join(process.cwd(), 'src/background/chromium/cdp-automation.ts');
const sharedBackground = join(process.cwd(), 'src/background/shared/collaboration-runtime.ts');

test('registers the actual Chrome runtime Extension ID', async () => {
  const source = await readFile(sharedBackground, 'utf8');
  assert.match(source, /extensionId: chrome\.runtime\.id/);
  assert.match(await readFile(chromiumBackground, 'utf8'), /startCollaborationBackground/);
});

test('keeps target-scoped automation failures out of the global error banner', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('private async handleTargetRequest'),
    source.indexOf('private async attachTarget'),
  );
  const attachHandler = source.slice(
    source.indexOf('private async attachTarget'),
    source.indexOf('private async runCdpCommand'),
  );

  assert.match(targetRequestHandler, /this\.sendTargetResult/);
  assert.match(targetRequestHandler, /success: false/);
  assert.match(attachHandler, /type: 'cdp\.attached'/);
  assert.match(attachHandler, /success: false/);
  assert.doesNotMatch(targetRequestHandler, /lastError\s*=/);
  assert.doesNotMatch(attachHandler, /lastError\s*=/);
});

test('marks the current document on Agent commands without persisting across navigation', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const attachHandler = source.slice(
    source.indexOf('private async attachTarget'),
    source.indexOf('private async runCdpCommand'),
  );
  const commandHandler = source.slice(
    source.indexOf('private async runCdpCommand'),
    source.indexOf('private async detachTarget'),
  );
  const tabUpdatedHandler = source.slice(
    source.indexOf('private async handleTabUpdated'),
    source.indexOf('private async handlePermissionsRemoved'),
  );

  assert.ok(
    commandHandler.indexOf('cdpCommandTouchesDocument(message.method)') <
      commandHandler.indexOf('this.controlledTabs.set(message.targetId, current)') &&
      commandHandler.indexOf('this.controlledTabs.set(message.targetId, current)') <
        commandHandler.indexOf('await applyControlledFavicon(current.id)') &&
      commandHandler.indexOf('await applyControlledFavicon(current.id)') <
        commandHandler.indexOf('await chrome.debugger.sendCommand'),
  );
  assert.match(attachHandler, /this\.attachedTabs\.set\(targetId, summary\)/);
  assert.doesNotMatch(attachHandler, /this\.controlledTabs\.set/);
  assert.doesNotMatch(attachHandler, /applyControlledFavicon/);
  assert.doesNotMatch(tabUpdatedHandler, /applyControlledFavicon/);
});

test('deduplicates unchanged target metadata before publishing lifecycle events', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const publisher = source.slice(
    source.indexOf('private async publishTargetForTab'),
    source.indexOf('private queueTargetPublication'),
  );

  assert.match(publisher, /targetInfoEquals\(previous, target\)/);
  assert.ok(
    publisher.indexOf('targetInfoEquals(previous, target)') <
      publisher.indexOf("type: 'cdp.target.event'"),
  );
  assert.match(publisher, /event: previous \? 'changed' : 'created'/);
});

test('bounds target discovery to the initial inventory and controlled opener relationships', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const shared = await readFile(sharedBackground, 'utf8');
  const targetList = source.slice(
    source.indexOf('private async listEligibleTargets'),
    source.indexOf('private sendTargetResult'),
  );
  const lifecycle = source.slice(
    source.indexOf('private async publishTargetForTab'),
    source.indexOf('private async handlePermissionsRemoved'),
  );
  const release = source.slice(
    source.indexOf('private async releaseControl'),
    source.indexOf('private controlledTargetIdForTab'),
  );

  assert.match(targetList, /this\.targetExposure\.seedEligible/);
  assert.match(targetList, /this\.targetExposure\.has/);
  assert.match(lifecycle, /this\.targetExposure\.has\(summary\.id\)/);
  assert.match(lifecycle, /this\.controlledTabs\.has\(sourceTargetId\)/);
  assert.match(lifecycle, /this\.targetExposure\.exposeRelated/);
  assert.match(source, /tab\.openerTabId/);
  assert.match(shared, /onCreatedNavigationTarget/);
  assert.match(lifecycle, /this\.targetPublicationQueue\s*\.enqueue/);
  assert.match(release, /this\.targetExposure\.clear\(\)/);
});

test('turns target creation authorization failures into Extension guidance', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('private async handleTargetRequest'),
    source.indexOf('private async attachTarget'),
  );

  assert.match(targetRequestHandler, /this\.authorizationRequest = 'all-tabs'/);
  assert.match(targetRequestHandler, /Open Panerelay, authorize all tabs, then retry/);
  assert.ok(
    targetRequestHandler.indexOf("this.authorizationRequest = 'all-tabs'") <
      targetRequestHandler.indexOf('chrome.tabs.create'),
  );
});

test('keeps Agent-created and selected targets in the background', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const targetRequestHandler = source.slice(
    source.indexOf('private async handleTargetRequest'),
    source.indexOf('private async attachTarget'),
  );

  assert.match(targetRequestHandler, /chrome\.tabs\.create\(\{ url, active: false \}\)/);
  assert.doesNotMatch(targetRequestHandler, /chrome\.tabs\.update/);
  assert.doesNotMatch(targetRequestHandler, /chrome\.windows\.update/);
  assert.match(
    targetRequestHandler,
    /case 'activate':[\s\S]*this\.targetInfo\(await this\.tabForTarget\(message\.operation\.targetId\)\)/,
  );
});

test('validates controlled-tab membership before activating or closing a Chrome tab', async () => {
  const source = await readFile(chromiumAutomation, 'utf8');
  const controlledActions = source.slice(
    source.indexOf('async activateTarget'),
    source.indexOf('private installDebuggerListeners'),
  );

  assert.match(controlledActions, /this\.controlledTabs\.has\(targetId\)/);
  assert.ok(
    controlledActions.indexOf('this.controlledTargetIdForTab(tabId)') <
      controlledActions.indexOf('chrome.tabs.update'),
  );
  assert.ok(
    controlledActions.lastIndexOf('this.controlledTargetIdForTab(tabId)') <
      controlledActions.indexOf('chrome.tabs.remove'),
  );
});

test('injects and coordinates page comments across authorized reachable frames', async () => {
  const source = await readFile(sharedBackground, 'utf8');
  const pageCommentSetup = source.slice(
    source.indexOf('const pageCommentService'),
    source.indexOf('async function status'),
  );
  const runtimeRouter = source.slice(
    source.indexOf('chrome.runtime.onMessage.addListener'),
    source.indexOf('chrome.tabs.onRemoved.addListener'),
  );

  assert.match(pageCommentSetup, /target: \{ tabId, allFrames: true \}/);
  assert.match(runtimeRouter, /panerelay\.page-comment\.frame-active/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.frame-active/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.pause/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.resume/);
  assert.match(runtimeRouter, /panerelay\.page-comments\.stop/);
  assert.doesNotMatch(runtimeRouter, /sender\.frameId/);
});
