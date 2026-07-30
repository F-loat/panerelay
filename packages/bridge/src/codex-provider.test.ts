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
  });
  assert.equal((detail as { conversation: { id: string } }).conversation.id, 'thread-new');
  const startRequest = client.requests.find(request => request.method === 'thread/start');
  assert.ok(startRequest);
  const params = startRequest.params as Record<string, unknown>;
  const config = params.config as Record<string, unknown>;
  assert.equal(config['mcp_servers.panerelay_browser.command'], '/usr/local/bin/agent-browser');
  assert.deepEqual(config['mcp_servers.panerelay_browser.args'], ['mcp', '--tools', 'core,tabs']);
  assert.equal(params.approvalPolicy, 'on-request');
  assert.equal(params.sandbox, 'read-only');
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

  await provider.listConversations();

  const listRequest = client.requests.find(request => request.method === 'thread/list');
  assert.deepEqual(listRequest?.params, {
    cursor: null,
    limit: 30,
    sortKey: 'updated_at',
    sortDirection: 'desc',
    archived: false,
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
