import assert from 'node:assert/strict';
import test from 'node:test';
import { FetchPermissionRequestManager } from './fetch-permission-requests.js';

function environment() {
  const decisions = new Set<(message: unknown) => void>();
  const removals = new Set<(windowId: number) => void>();
  const calls: string[] = [];
  return {
    calls,
    decisions,
    removals,
    value: {
      addDecisionListener(listener: (message: unknown) => void) {
        decisions.add(listener);
      },
      removeDecisionListener(listener: (message: unknown) => void) {
        decisions.delete(listener);
      },
      addWindowRemovedListener(listener: (windowId: number) => void) {
        removals.add(listener);
      },
      removeWindowRemovedListener(listener: (windowId: number) => void) {
        removals.delete(listener);
      },
      async createPopup(url: string) {
        calls.push(url);
        return 42;
      },
      async removeWindow(windowId: number) {
        calls.push(`remove:${windowId}`);
      },
      extensionUrl(path: string) {
        return `chrome-extension://extension/${path}`;
      },
      async containsOrigins(origins: string[]) {
        calls.push(`contains:${origins.join(',')}`);
        return true;
      },
      async isDomainAuthorized(domain: string) {
        calls.push(`authorized:${domain}`);
        return false;
      },
      async grantDomain(domain: string) {
        calls.push(`grant:${domain}`);
      },
      async revokeDomain(domain: string) {
        calls.push(`revoke:${domain}`);
      },
    },
  };
}

test('reuses an existing domain and Chrome permission without opening a popup', async () => {
  const setup = environment();
  setup.value.isDomainAuthorized = async domain => {
    setup.calls.push(`authorized:${domain}`);
    return true;
  };
  const result = await new FetchPermissionRequestManager(setup.value, 1_000).request(
    'api.example.com',
  );
  assert.deepEqual(result, {
    protocol: 'panerelay.fetch-permission.v1',
    granted: true,
    domain: 'api.example.com',
    scope: 'domain',
  });
  assert.deepEqual(setup.calls, [
    'authorized:api.example.com',
    'contains:http://api.example.com/*,https://api.example.com/*',
  ]);
});

function requestIdFrom(calls: string[]): string {
  return new URL(calls.find(call => call.startsWith('chrome-extension://'))!).searchParams.get(
    'requestId',
  )!;
}

test('settles domain approval once after Chrome permission is present', async () => {
  const setup = environment();
  const manager = new FetchPermissionRequestManager(setup.value, 1_000);
  const pending = manager.request('api.example.com');
  await new Promise(resolve => setImmediate(resolve));
  const message = {
    type: 'panerelay.fetch-permission.decision',
    requestId: requestIdFrom(setup.calls),
    granted: true,
    scope: 'domain',
  };
  for (const listener of setup.decisions) listener(message);
  for (const listener of setup.decisions) listener(message);
  assert.deepEqual(await pending, {
    protocol: 'panerelay.fetch-permission.v1',
    granted: true,
    domain: 'api.example.com',
    scope: 'domain',
  });
  assert.equal(setup.calls.filter(call => call.startsWith('grant:')).length, 1);
});

test('explicit denial revokes the requested grant while passive exits only fail closed', async () => {
  const deniedSetup = environment();
  const deniedManager = new FetchPermissionRequestManager(deniedSetup.value, 1_000);
  const denied = deniedManager.request('api.example.com');
  await new Promise(resolve => setImmediate(resolve));
  for (const listener of deniedSetup.decisions) {
    listener({
      type: 'panerelay.fetch-permission.decision',
      requestId: requestIdFrom(deniedSetup.calls),
      granted: false,
    });
  }
  assert.equal((await denied).granted, false);
  assert.equal(deniedSetup.calls.includes('revoke:api.example.com'), true);

  const closedSetup = environment();
  const closed = new FetchPermissionRequestManager(closedSetup.value, 1_000).request(
    'api.example.com',
  );
  await new Promise(resolve => setImmediate(resolve));
  for (const listener of closedSetup.removals) listener(42);
  assert.equal((await closed).granted, false);
  assert.equal(
    closedSetup.calls.some(call => call.startsWith('revoke:')),
    false,
  );

  const timeoutSetup = environment();
  const timedOut = new FetchPermissionRequestManager(timeoutSetup.value, 5).request(
    'api.example.com',
  );
  assert.equal((await timedOut).granted, false);
  assert.equal(
    timeoutSetup.calls.some(call => call.startsWith('revoke:')),
    false,
  );

  const cancelSetup = environment();
  const cancelManager = new FetchPermissionRequestManager(cancelSetup.value, 1_000);
  const cancelled = cancelManager.request('api.example.com');
  await new Promise(resolve => setImmediate(resolve));
  cancelManager.cancelAll('Browser generation changed');
  await assert.rejects(cancelled, /Browser generation changed/);
  assert.equal(
    cancelSetup.calls.some(call => call.startsWith('revoke:')),
    false,
  );
});

test('does not persist a decision whose Chrome check outlives cancellation', async () => {
  const setup = environment();
  let finishChromeCheck: ((granted: boolean) => void) | undefined;
  setup.value.containsOrigins = async () =>
    new Promise<boolean>(resolve => {
      finishChromeCheck = resolve;
    });
  const manager = new FetchPermissionRequestManager(setup.value, 1_000);
  const pending = manager.request('*.baidu.com');
  await new Promise(resolve => setImmediate(resolve));
  for (const listener of setup.decisions) {
    listener({
      type: 'panerelay.fetch-permission.decision',
      requestId: requestIdFrom(setup.calls),
      granted: true,
      scope: 'domain',
    });
  }
  await Promise.resolve();
  manager.cancelAll('Browser generation changed');
  finishChromeCheck?.(true);
  await assert.rejects(pending, /Browser generation changed/);
  await Promise.resolve();
  assert.equal(
    setup.calls.some(call => call.startsWith('grant:')),
    false,
  );
});

test('uses the Bridge request id and closes the popup when that request is cancelled', async () => {
  const setup = environment();
  const controller = new AbortController();
  const pending = new FetchPermissionRequestManager(setup.value, 1_000).request('api.example.com', {
    requestId: 'bridge-request',
    signal: controller.signal,
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requestIdFrom(setup.calls), 'bridge-request');
  controller.abort();
  await assert.rejects(pending, /authorization was cancelled/);
  assert.equal(setup.calls.includes('remove:42'), true);
  assert.equal(setup.decisions.size, 0);
  assert.equal(setup.removals.size, 0);
});
