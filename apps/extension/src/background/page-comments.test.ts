import assert from 'node:assert/strict';
import test from 'node:test';
import type { TabSummary } from '../shared/messages.js';
import { PageCommentService } from './page-comments.js';

const darkAccent = {
  color: '#336699',
  contrast: '#ffffff',
  hover: '#527da8',
  outline: '#0b0c0c',
  soft: 'rgb(51 102 153 / 14%)',
};

const lightAccent = {
  color: '#224466',
  contrast: '#ffffff',
  hover: '#1e3c5a',
  outline: '#ffffff',
  soft: 'rgb(34 68 102 / 10%)',
};

function harness() {
  let active: TabSummary | null = {
    id: 11,
    title: 'Fixture',
    url: 'https://example.com/page',
  };
  let authorized = true;
  let runtimeReady = true;
  const messages: Array<{ tabId: number; message: Record<string, unknown> }> = [];
  let resets = 0;
  const service = new PageCommentService({
    broadcastReset: async () => {
      resets += 1;
    },
    ensureRuntime: async () => runtimeReady,
    isAuthorized: async () => authorized,
    resolveActiveTab: async () => active,
    sendToTab: async (tabId, message) => {
      messages.push({ tabId, message });
    },
  });
  return {
    messages,
    resets: () => resets,
    service,
    setActive(value: TabSummary | null) {
      active = value;
    },
    setAuthorized(value: boolean) {
      authorized = value;
    },
    setRuntimeReady(value: boolean) {
      runtimeReady = value;
    },
  };
}

test('starts and routes page comment actions only on the authorized active tab', async () => {
  const { messages, service } = harness();
  await service.start(false, 'zh-CN', 'dark', darkAccent);
  await service.updateAppearance('light', lightAccent);
  await service.edit('comment-1');
  await service.remove('comment-1');
  await service.stop();

  assert.deepEqual(
    messages.map(item => item.message),
    [
      {
        type: 'panerelay.page-comments.start',
        continuous: false,
        locale: 'zh-CN',
        theme: 'dark',
        accent: darkAccent,
        topPage: {
          title: 'Fixture',
          url: 'https://example.com/page',
        },
      },
      { type: 'panerelay.page-comments.appearance', theme: 'light', accent: lightAccent },
      { type: 'panerelay.page-comments.edit', commentId: 'comment-1' },
      { type: 'panerelay.page-comments.remove', commentId: 'comment-1' },
      { type: 'panerelay.page-comments.stop' },
    ],
  );
  assert.ok(messages.every(item => item.tabId === 11));
});

test('redacts top-page metadata before broadcasting it to iframe runtimes', async () => {
  const current = harness();
  current.setActive({
    id: 11,
    title: '  Fixture   page  ',
    url: 'https://user:password@example.com/page?token=secret&view=ok#session=private',
  });
  await current.service.start();

  assert.deepEqual(current.messages[0]?.message.topPage, {
    title: 'Fixture page',
    url: 'https://example.com/page?token=%5Bredacted%5D&view=ok#[redacted]',
  });
});

test('fails closed without authorization or a usable runtime', async () => {
  const unauthorized = harness();
  unauthorized.setAuthorized(false);
  await assert.rejects(unauthorized.service.start(), /Authorize this page/);
  assert.deepEqual(unauthorized.messages, []);

  const unavailable = harness();
  unavailable.setRuntimeReady(false);
  await assert.rejects(unavailable.service.start(), /could not start page comments/);
  assert.deepEqual(unavailable.messages, []);
});

test('clears comments on tab, document, and authorization lifecycle changes', async () => {
  const current = harness();
  await current.service.start();
  await current.service.resetIfTabChanged(22);
  assert.deepEqual(current.messages.at(-1), {
    tabId: 11,
    message: { type: 'panerelay.page-comments.clear' },
  });
  assert.equal(current.resets(), 1);

  const navigated = harness();
  await navigated.service.start();
  await navigated.service.resetIfDocumentEnded(11);
  assert.equal(navigated.resets(), 1);

  const revoked = harness();
  await revoked.service.start();
  revoked.setAuthorized(false);
  await assert.rejects(revoked.service.stop(), /Authorize this page/);
  await assert.rejects(
    revoked.service.updateAppearance('light', lightAccent),
    /Authorize this page/,
  );
  assert.equal(
    revoked.messages.some(item => item.message.type === 'panerelay.page-comments.appearance'),
    false,
  );
});
