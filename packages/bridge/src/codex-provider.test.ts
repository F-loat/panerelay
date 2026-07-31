import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationEvent } from '@panerelay/protocol';
import { CodexProvider, type CodexClient, type CodexProviderOptions } from './codex-provider.js';
import type { CodexRpcMessage } from './codex-app-server.js';

class FakeCodexClient implements CodexClient {
  readonly requests: Array<{ method: string; params: unknown }> = [];
  readonly responses: Array<{ id: number | string; result: unknown }> = [];
  startCalls = 0;
  startBarrier: Promise<void> | undefined;

  async start(): Promise<void> {
    this.startCalls += 1;
    await this.startBarrier;
  }

  async request(method: string, params: unknown = {}): Promise<unknown> {
    this.requests.push({ method, params });
    if (method === 'thread/list') {
      return {
        data: [
          {
            id: 'thread-1',
            name: null,
            preview: 'Inspect the current page',
            createdAt: 1_700_000_000,
            updatedAt: 1_700_000_100,
            status: { type: 'idle' },
          },
        ],
      };
    }
    if (method === 'thread/start') {
      return {
        thread: {
          id: 'thread-new',
          preview: '',
          createdAt: 1_700_000_200,
          updatedAt: 1_700_000_200,
          status: { type: 'idle' },
        },
      };
    }
    if (method === 'turn/start') {
      return { turn: { id: 'turn-1', status: 'inProgress' } };
    }
    return {};
  }

  respond(id: number | string, result: unknown): void {
    this.responses.push({ id, result });
  }

  async close(): Promise<void> {}
}

function createProvider() {
  const events: ConversationEvent[] = [];
  const client = new FakeCodexClient();
  let handlers: Parameters<NonNullable<CodexProviderOptions['createClient']>>[1] | undefined;
  const provider = new CodexProvider({
    environment: { PANERELAY_BROWSER_ID: 'sidepanel-browser-id' },
    onEvent: event => events.push(event),
    runtimeConfig: async () => ({
      codexPath: '/usr/local/bin/codex',
      agentBrowserPath: '/usr/local/bin/agent-browser',
      agentBrowserConfigPath: '/Users/test/.panerelay/agent-browser.json',
    }),
    createClient: (_config, nextHandlers) => {
      handlers = nextHandlers;
      return client;
    },
  });
  return {
    provider,
    client,
    events,
    handlers: () => {
      if (!handlers) throw new Error('Codex handlers have not been initialized');
      return handlers;
    },
  };
}

test('exposes Codex through provider-neutral conversation results', async () => {
  const { provider, client } = createProvider();

  const providers = await provider.handle({ method: 'agent.providers' });
  assert.deepEqual(providers, [
    {
      id: 'codex',
      name: 'Codex',
      status: 'ready',
      description: 'Local Codex app-server with streamed turns, tools, and approvals.',
      capabilities: {
        approvals: true,
        imageInput: true,
        interrupt: true,
        listConversations: true,
        resume: true,
        streaming: true,
      },
      setup: {
        installCommand: 'npm install -g @openai/codex',
        loginCommand: 'codex login',
        docsUrl: 'https://developers.openai.com/codex/cli',
      },
    },
  ]);

  const conversations = await provider.handle({
    method: 'conversation.list',
    providerId: 'codex',
  });
  assert.deepEqual(conversations, [
    {
      id: 'thread-1',
      providerId: 'codex',
      title: 'Inspect the current page',
      preview: 'Inspect the current page',
      status: 'idle',
      createdAt: '2023-11-14T22:13:20.000Z',
      updatedAt: '2023-11-14T22:15:00.000Z',
    },
  ]);

  const detail = await provider.handle({
    method: 'conversation.start',
    providerId: 'codex',
    options: {
      cwd: process.cwd(),
      initialPage: {
        url: 'https://example.com/app?token=secret',
        title: 'Example app',
      },
    },
  });
  assert.equal((detail as { conversation: { id: string } }).conversation.id, 'thread-new');
  const startRequest = client.requests.find(request => request.method === 'thread/start');
  assert.ok(startRequest);
  const params = startRequest.params as Record<string, unknown>;
  const config = params.config as Record<string, unknown>;
  assert.equal(config['mcp_servers.panerelay_browser.command'], '/usr/local/bin/agent-browser');
  assert.deepEqual(config['mcp_servers.panerelay_browser.args'], ['mcp', '--tools', 'core,tabs']);
  const browserEnvironment = config['mcp_servers.panerelay_browser.env'] as Record<string, string>;
  assert.equal(
    browserEnvironment.AGENT_BROWSER_CONFIG,
    '/Users/test/.panerelay/agent-browser.json',
  );
  assert.equal(browserEnvironment.AGENT_BROWSER_PROVIDER, 'panerelay');
  assert.match(browserEnvironment.AGENT_BROWSER_SESSION || '', /^panerelay-codex-/);
  assert.equal(browserEnvironment.PANERELAY_BROWSER_ID, 'sidepanel-browser-id');
  assert.equal(params.approvalPolicy, 'on-request');
  assert.equal(params.sandbox, 'read-only');
  assert.equal(params.cwd, process.cwd());
  assert.match(String(params.developerInstructions), /Example app/);
  assert.match(String(params.developerInstructions), /%5BREDACTED%5D/);
  assert.doesNotMatch(String(params.developerInstructions), /secret/);
  assert.doesNotMatch(String(params.developerInstructions), /"tabId"/);

  await provider.sendMessage('thread-new', '', [
    { data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' },
  ]);
  const turn = client.requests.find(request => request.method === 'turn/start');
  assert.deepEqual(turn?.params, {
    threadId: 'thread-new',
    input: [{ type: 'image', url: 'data:image/png;base64,AQID' }],
  });
});

test('prepares Codex once for concurrent warmups without creating a conversation', async () => {
  const { provider, client } = createProvider();
  let releaseStart!: () => void;
  client.startBarrier = new Promise<void>(resolve => {
    releaseStart = resolve;
  });

  const first = provider.prepare();
  const second = provider.prepare();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(client.startCalls, 1);
  assert.deepEqual(client.requests, []);

  releaseStart();
  await Promise.all([first, second]);
  await provider.prepare();

  assert.equal(client.startCalls, 1);
  assert.deepEqual(client.requests, []);
});

test('lists recent Codex history across sources and working directories', async () => {
  const { provider, client } = createProvider();

  await provider.listConversations('/workspace/project');

  const listRequest = client.requests.find(request => request.method === 'thread/list');
  assert.deepEqual(listRequest?.params, {
    cursor: null,
    limit: 30,
    sortKey: 'updated_at',
    sortDirection: 'desc',
    archived: false,
    cwd: '/workspace/project',
  });
});

test('normalizes streaming, activity, completion, and approval events', async () => {
  const { provider, client, events, handlers } = createProvider();
  await provider.handle({
    method: 'conversation.list',
    providerId: 'codex',
  });

  handlers().onNotification({
    method: 'turn/started',
    params: {
      threadId: 'thread-1',
      turn: { id: 'turn-1', status: 'inProgress' },
    },
  });
  handlers().onNotification({
    method: 'item/agentMessage/delta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'message-1',
      delta: 'Hello',
    },
  });
  handlers().onNotification({
    method: 'item/started',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        type: 'mcpToolCall',
        id: 'tool-1',
        server: 'panerelay_browser',
        tool: 'agent_browser_snapshot',
        status: 'inProgress',
      },
    },
  });
  handlers().onServerRequest({
    id: 91,
    method: 'item/commandExecution/requestApproval',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'command-1',
      command: 'git status --short',
      cwd: '/repo',
    },
  } as CodexRpcMessage & { id: number; method: string });

  assert.equal(events[0]?.kind, 'turn.started');
  assert.equal(events[1]?.kind, 'message.delta');
  assert.deepEqual(events[2], {
    kind: 'activity.updated',
    conversationId: 'thread-1',
    turnId: 'turn-1',
    activity: {
      id: 'tool-1',
      kind: 'browser',
      title: 'panerelay_browser · agent_browser_snapshot',
      status: 'running',
    },
  });
  assert.equal(events[3]?.kind, 'approval.requested');

  handlers().onNotification({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        type: 'mcpToolCall',
        id: 'tool-1',
        server: 'panerelay_browser',
        tool: 'agent_browser_snapshot',
        status: 'failed',
        error: {
          message: 'CDP error (Target.createTarget): all-tabs authorization is required',
        },
      },
    },
  });
  assert.deepEqual(events[4], {
    kind: 'activity.updated',
    conversationId: 'thread-1',
    turnId: 'turn-1',
    activity: {
      id: 'tool-1',
      kind: 'browser',
      title: 'panerelay_browser · agent_browser_snapshot',
      detail: 'CDP error (Target.createTarget): all-tabs authorization is required',
      status: 'failed',
    },
  });
  handlers().onNotification({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        type: 'mcpToolCall',
        id: 'tool-bounded',
        server: 'panerelay_browser',
        tool: 'agent_browser_snapshot',
        status: 'failed',
        error: { message: 'x'.repeat(9_000) },
      },
    },
  });
  const boundedFailure = events[5];
  assert.equal(boundedFailure?.kind, 'activity.updated');
  if (boundedFailure?.kind === 'activity.updated') {
    assert.equal(boundedFailure.activity.detail?.length, 8 * 1024);
  }

  await provider.handle({
    method: 'conversation.respond',
    providerId: 'codex',
    conversationId: 'thread-1',
    approvalId: 'codex:91',
    decision: 'accept',
  });
  assert.deepEqual(client.responses, [{ id: 91, result: { decision: 'accept' } }]);
  assert.equal(events.at(-1)?.kind, 'approval.resolved');
});
