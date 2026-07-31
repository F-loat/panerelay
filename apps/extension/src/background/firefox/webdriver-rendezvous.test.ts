import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';
import { FirefoxWebDriverAutomationAdapter } from './webdriver-rendezvous.js';
import type { CollaborationAutomationContext } from '../shared/collaboration-runtime.js';

function installChromeMock(): { setPermission: (value: boolean) => void } {
  const storage = new Map<string, unknown>();
  let permission = true;
  globalThis.chrome = {
    permissions: {
      contains: async () => permission,
      request: async () => true,
    },
    scripting: {
      executeScript: async () => [{ result: true }],
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: storage.get(key) }),
        remove: async (key: string) => {
          storage.delete(key);
        },
        set: async (value: Record<string, unknown>) => {
          for (const [key, item] of Object.entries(value)) storage.set(key, item);
        },
      },
    },
    tabs: {
      query: async () => [],
      remove: async () => {},
      update: async () => ({}),
    },
  } as unknown as typeof chrome;
  return {
    setPermission: value => {
      permission = value;
    },
  };
}

function context(sent: unknown[]): CollaborationAutomationContext {
  return {
    activeTab: async () => ({ id: 7, title: 'Authorized', url: 'https://example.test/' }),
    broadcastStatus: async () => {},
    registerBrowser: async () => {},
    sendNative: message => sent.push(message),
    summarizeTab: tab =>
      typeof tab.id === 'number'
        ? { id: tab.id, title: tab.title || '', url: tab.url || '' }
        : null,
  };
}

test('Firefox authorization remains unavailable until managed WebDriver readiness', async () => {
  installChromeMock();
  const adapter = new FirefoxWebDriverAutomationAdapter();
  await assert.rejects(adapter.setAuthorization('single-tab', context([])), /reopen it/);
});

test('rendezvous accepts only an authorized top-document sender and emits opaque identities', async () => {
  installChromeMock();
  const sent: Array<Record<string, unknown>> = [];
  const adapter = new FirefoxWebDriverAutomationAdapter();
  const automationContext = context(sent);
  await adapter.handleHostMessage(
    {
      type: 'webdriver.readiness',
      protocol: PANERELAY_PROTOCOL_VERSION,
      ready: true,
      reason: 'ready',
      message: 'ready',
    },
    automationContext,
  );
  await adapter.setAuthorization('single-tab', automationContext);
  sent.length = 0;

  const message = {
    type: 'panerelay.webdriver.rendezvous',
    requestId: 'request-1',
    challenge: 'challenge-value-1234',
    documentId: 'document-1',
  };
  adapter.handleRuntimeMessage(
    message,
    {
      frameId: 1,
      tab: { id: 7, active: true, title: 'Authorized', url: 'https://example.test/' },
    },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 0);

  adapter.handleRuntimeMessage(
    message,
    {
      frameId: 0,
      tab: { id: 7, active: true, title: 'Authorized', url: 'https://example.test/' },
    },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.type, 'webdriver.rendezvous.result');
  assert.equal(sent[0]?.requestId, 'request-1');
  assert.equal(sent[0]?.challenge, 'challenge-value-1234');
  assert.equal(typeof sent[0]?.targetId, 'string');
  assert.equal('tabId' in sent[0]!, false);
});

test('rendezvous fails closed for unauthorized tabs, removed permission, and navigation', async () => {
  const permissions = installChromeMock();
  const sent: Array<Record<string, unknown>> = [];
  const adapter = new FirefoxWebDriverAutomationAdapter();
  const automationContext = context(sent);
  await adapter.handleHostMessage(
    {
      type: 'webdriver.readiness',
      protocol: PANERELAY_PROTOCOL_VERSION,
      ready: true,
      reason: 'ready',
      message: 'ready',
    },
    automationContext,
  );
  await adapter.setAuthorization('single-tab', automationContext);
  sent.length = 0;

  const message = {
    type: 'panerelay.webdriver.rendezvous',
    requestId: 'request-adversarial',
    challenge: 'challenge-value-adversarial',
    documentId: 'document-before-navigation',
  };
  adapter.handleRuntimeMessage(
    message,
    {
      frameId: 0,
      tab: { id: 8, active: false, title: 'Other', url: 'https://example.test/' },
    },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 0);

  permissions.setPermission(false);
  adapter.handleRuntimeMessage(
    message,
    {
      frameId: 0,
      tab: { id: 7, active: true, title: 'Authorized', url: 'https://example.test/' },
    },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 0);

  permissions.setPermission(true);
  adapter.handleRuntimeMessage(
    message,
    {
      frameId: 0,
      tab: { id: 7, active: true, title: 'Authorized', url: 'https://example.test/' },
    },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  const rendezvous = sent.find(item => item.type === 'webdriver.rendezvous.result');
  assert.ok(rendezvous);
  sent.length = 0;

  adapter.onTabUpdated(
    7,
    { status: 'loading' },
    { id: 7, active: true, title: 'Authorized', url: 'https://example.test/' },
    automationContext,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent[0], {
    type: 'webdriver.target.invalidated',
    protocol: PANERELAY_PROTOCOL_VERSION,
    targetId: rendezvous.targetId,
    documentId: 'document-before-navigation',
    reason: 'navigation',
  });
});
