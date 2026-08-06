import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRequest, ConversationSummary } from '@panerelay/protocol';
import type { ExtensionStatus } from '../shared/messages.js';
import { createConversationTimelineSnapshot } from '../shared/conversation-timeline.js';
import {
  createSidePanelRequestRouter,
  mergeConversationHistory,
  type SidePanelRequestRouterOptions,
} from './sidepanel-request-router.js';

const extensionStatus = {
  bridgeConnected: true,
  nativeHostState: 'connected',
  hostRelease: {
    state: 'ready',
    hostVersion: '0.7.0',
    targetVersion: '0.7.0',
    retryAvailable: false,
  },
  defaultProvider: null,
  browserUseDefault: null,
  browserDefault: null,
  authorizationRequest: null,
  activeTab: null,
  authorizationMode: 'none',
  authorizedOriginPatterns: [],
  authorizedTab: null,
  controlledTab: null,
  controlledTabs: [],
  controlSession: null,
  automationActivities: [],
  automationHistoryGap: false,
} satisfies ExtensionStatus;

function router(overrides: Partial<SidePanelRequestRouterOptions> = {}) {
  const calls: string[] = [];
  const requests: AgentRequest[] = [];
  const workspace = {
    revision: 3,
    providerId: 'codex',
    conversationId: null,
    projectDirectory: null,
    relatedTabIds: [],
  };
  const options = {
    activateControlledTab: async (tabId: number) => {
      calls.push(`activate:${tabId}`);
    },
    closeControlledTab: async (tabId: number) => {
      calls.push(`close:${tabId}`);
    },
    installIntegration: async integration => {
      calls.push(`install:${integration}`);
      return extensionStatus;
    },
    pageComments: {
      clear: async () => calls.push('comments:clear'),
      edit: async (id: string) => calls.push(`comments:edit:${id}`),
      remove: async (id: string) => calls.push(`comments:remove:${id}`),
      start: async (continuous: boolean) => calls.push(`comments:start:${continuous}`),
      stop: async () => calls.push('comments:stop'),
      updateAppearance: async () => calls.push('comments:appearance'),
    },
    releaseControl: async () => {
      calls.push('control:release');
      return extensionStatus;
    },
    refreshBrowserDefault: async () => {
      calls.push('browser:refresh');
    },
    refreshBrowserUseDefault: async () => {
      calls.push('browser-use:refresh');
    },
    requestAgent: async (request: AgentRequest) => {
      requests.push(request);
      if (request.method === 'agent.providers') return [{ id: 'codex', name: 'Codex' }];
      if (request.method === 'conversation.list') return [];
      return undefined;
    },
    retryNativeHost: async () => extensionStatus,
    retryHostUpdate: async () => extensionStatus,
    selectWorkspaceDirectory: async () => '/workspace',
    setAuthorization: async () => extensionStatus,
    setBrowserDefault: async () => extensionStatus,
    setBrowserUseDefault: async enabled => {
      calls.push(`browser-use:${enabled}`);
      return extensionStatus;
    },
    setDefaultProvider: async () => extensionStatus,
    status: async () => extensionStatus,
    timelines: {
      list: async () => [],
      load: async () => ({ snapshot: null, events: [] }),
      save: async value => value,
    },
    workspace: {
      get: async () => workspace,
      reset: async () => workspace,
      resume: async () => ({ workspace }),
      send: async () => ({ workspace, turnId: 'turn-1' }),
      setDirectory: async () => workspace,
    },
    ...overrides,
  } as unknown as SidePanelRequestRouterOptions;
  return { calls, handle: createSidePanelRequestRouter(options), requests };
}

function conversation(
  id: string,
  updatedAt: string,
  title = id,
  providerId = 'qoder',
): ConversationSummary {
  return {
    id,
    providerId,
    title,
    preview: '',
    status: 'idle',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt,
  };
}

test('routes status, browser settings, and controlled-tab requests', async () => {
  const { calls, handle } = router();
  assert.deepEqual(await handle({ type: 'panerelay.status.get' }), {
    success: true,
    status: extensionStatus,
  });
  await handle({ type: 'panerelay.browser-default.refresh' });
  await handle({ type: 'panerelay.browser-use-default.refresh' });
  await handle({ type: 'panerelay.browser-use-default.set', enabled: true });
  await handle({ type: 'panerelay.integration.install', integration: 'agent-browser' });
  assert.deepEqual(await handle({ type: 'panerelay.control.release' }), {
    success: true,
    status: extensionStatus,
  });
  await handle({ type: 'panerelay.controlled-tab.activate', tabId: 7 });
  await handle({ type: 'panerelay.controlled-tab.close', tabId: 8 });
  assert.deepEqual(calls, [
    'browser:refresh',
    'browser-use:refresh',
    'browser-use:true',
    'install:agent-browser',
    'control:release',
    'activate:7',
    'close:8',
  ]);
});

test('routes provider, workspace, and conversation requests without changing payloads', async () => {
  const { handle, requests } = router();
  const providers = await handle({ type: 'panerelay.agent.providers' });
  assert.deepEqual(providers, {
    success: true,
    providers: [{ id: 'codex', name: 'Codex' }],
  });
  const selected = await handle({
    type: 'panerelay.workspace.pick-directory',
    expectedRevision: 3,
  });
  assert.equal(selected.success, true);
  const sent = await handle({
    type: 'panerelay.conversation.send',
    providerId: 'codex',
    expectedRevision: 3,
    text: 'hello',
  });
  assert.equal(sent.success, true);
  await handle({
    type: 'panerelay.conversation.interrupt',
    providerId: 'codex',
    conversationId: 'conversation-1',
    turnId: 'turn-1',
  });
  assert.deepEqual(requests.at(-1), {
    method: 'conversation.interrupt',
    providerId: 'codex',
    conversationId: 'conversation-1',
    turnId: 'turn-1',
  });
});

test('merges retained and provider conversation history with provider metadata precedence', async () => {
  const retained = [
    conversation('cached-only', '2026-08-05T00:00:03.000Z'),
    conversation('shared', '2026-08-05T00:00:04.000Z', 'Cached title'),
  ];
  const provider = [
    conversation('provider-only', '2026-08-05T00:00:05.000Z'),
    conversation('shared', '2026-08-05T00:00:02.000Z', 'Provider title'),
  ];
  const { handle } = router({
    requestAgent: async request => {
      if (request.method === 'conversation.list') return provider;
      return [];
    },
    timelines: {
      list: async () => retained,
      load: async () => ({ snapshot: null, events: [] }),
      save: async value => value,
    },
  });

  const response = await handle({ type: 'panerelay.conversation.list', providerId: 'qoder' });
  assert.deepEqual(
    response.conversations?.map(item => [item.id, item.title]),
    [
      ['provider-only', 'provider-only'],
      ['cached-only', 'cached-only'],
      ['shared', 'Provider title'],
    ],
  );
});

test('deduplicates only exact provider and conversation identifier pairs', () => {
  const retained = {
    ...conversation('b:c', '2026-08-05T00:00:03.000Z'),
    providerId: 'a',
  };
  const provider = {
    ...conversation('c', '2026-08-05T00:00:02.000Z'),
    providerId: 'a:b',
  };

  assert.deepEqual(mergeConversationHistory([retained], [provider]), [retained, provider]);
});

test('uses retained history when provider listing fails and preserves empty-cache failures', async () => {
  const failure = new Error('Qoder does not advertise ACP session listing');
  const retained = [conversation('cached-only', '2026-08-05T00:00:03.000Z')];
  const retainedRouter = router({
    requestAgent: async () => {
      throw failure;
    },
    timelines: {
      list: async () => retained,
      load: async () => ({ snapshot: null, events: [] }),
      save: async value => value,
    },
  });
  assert.deepEqual(
    await retainedRouter.handle({ type: 'panerelay.conversation.list', providerId: 'qoder' }),
    { success: true, conversations: retained },
  );

  const emptyRouter = router({
    requestAgent: async () => {
      throw failure;
    },
  });
  await assert.rejects(
    emptyRouter.handle({ type: 'panerelay.conversation.list', providerId: 'qoder' }),
    failure,
  );
});

test('routes page-comment commands to the existing service boundary', async () => {
  const { calls, handle } = router();
  await handle({
    type: 'panerelay.page-comments.start',
    continuous: true,
    locale: 'en',
    theme: 'dark',
  });
  await handle({ type: 'panerelay.page-comments.edit', commentId: 'comment-1' });
  await handle({
    type: 'panerelay.page-comments.appearance',
    theme: 'light',
    accent: {
      color: '#336699',
      contrast: '#ffffff',
      hover: '#224466',
      outline: '#ffffff',
      soft: 'rgb(51 102 153 / 10%)',
    },
  });
  await handle({ type: 'panerelay.page-comments.remove', commentId: 'comment-1' });
  await handle({ type: 'panerelay.page-comments.clear' });
  assert.deepEqual(calls, [
    'comments:start:true',
    'comments:edit:comment-1',
    'comments:appearance',
    'comments:remove:comment-1',
    'comments:clear',
  ]);
});

test('routes timeline loads and saves only through the session store boundary', async () => {
  const calls: string[] = [];
  const snapshot = createConversationTimelineSnapshot({
    providerId: 'qoder',
    conversation: {
      id: 'conversation-1',
      providerId: 'qoder',
      title: 'Conversation',
      preview: '',
      status: 'idle',
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:01.000Z',
    },
    timeline: [],
    runningTurnId: null,
    throughSequence: 0,
  });
  assert.ok(snapshot);
  const { handle } = router({
    timelines: {
      list: async () => [],
      load: async (providerId, conversationId) => {
        calls.push(`load:${providerId}:${conversationId}`);
        return { snapshot, events: [] };
      },
      save: async value => {
        calls.push(`save:${value.providerId}:${value.conversationId}`);
        return value;
      },
    },
  });

  assert.deepEqual(
    await handle({
      type: 'panerelay.conversation-timeline.load',
      providerId: 'qoder',
      conversationId: 'conversation-1',
    }),
    { success: true, timeline: { snapshot, events: [] } },
  );
  assert.deepEqual(await handle({ type: 'panerelay.conversation-timeline.save', snapshot }), {
    success: true,
  });
  assert.deepEqual(calls, ['load:qoder:conversation-1', 'save:qoder:conversation-1']);
});
