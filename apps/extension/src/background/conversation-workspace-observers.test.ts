import assert from 'node:assert/strict';
import test from 'node:test';
import { installConversationWorkspaceObservers } from './conversation-workspace-observers.js';
import { ConversationWorkspaceStore } from './conversation-workspaces.js';

test('observes trusted opener and navigation-target relationships without binding unrelated tabs', async () => {
  let createdTab: ((tab: chrome.tabs.Tab) => void) | undefined;
  let removedTab: ((tabId: number) => void) | undefined;
  let navigationTarget:
    ((details: chrome.webNavigation.WebNavigationSourceCallbackDetails) => void) | undefined;
  globalThis.chrome = {
    tabs: {
      onCreated: {
        addListener(listener) {
          createdTab = listener;
        },
      },
      onRemoved: {
        addListener(listener) {
          removedTab = listener;
        },
      },
    },
    webNavigation: {
      onCreatedNavigationTarget: {
        addListener(listener) {
          navigationTarget = listener;
        },
      },
    },
  } as typeof chrome;

  let nextId = 0;
  const store = new ConversationWorkspaceStore({ createId: () => `id-${++nextId}` });
  const inherited: number[] = [];
  const removed: number[] = [];
  installConversationWorkspaceObservers(store, {
    onInherited(tabId) {
      inherited.push(tabId);
    },
    onRemoved(tabId) {
      removed.push(tabId);
    },
  });
  await store.getOrCreate(11, 'codex');

  createdTab?.({ id: 22, openerTabId: 11 } as chrome.tabs.Tab);
  navigationTarget?.({
    sourceTabId: 11,
    sourceFrameId: 0,
    sourceProcessId: 1,
    tabId: 22,
    url: 'https://example.test/related',
    timeStamp: 1,
  });
  createdTab?.({ id: 33 } as chrome.tabs.Tab);
  await new Promise<void>(resolve => setImmediate(resolve));

  assert.deepEqual(await store.get(22), await store.get(11));
  assert.equal(await store.get(33), null);
  assert.deepEqual(inherited, [22, 22]);

  removedTab?.(11);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.ok(await store.get(22));
  assert.deepEqual(removed, [11]);
});
