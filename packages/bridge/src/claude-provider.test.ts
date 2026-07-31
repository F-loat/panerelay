import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationEvent } from '@panerelay/protocol';
import type {
  ClaudeCli,
  ClaudeCliMessage,
  ClaudeCliQuery,
  ClaudeCliQueryParameters,
} from './claude-cli.js';
import type {
  ClaudePermissionHandler,
  ClaudePermissionServer,
  ClaudePermissionToolRequest,
} from './claude-permission-server.js';
import { ClaudeProvider } from './claude-provider.js';

function queryFrom(cli: FakeClaudeCli, parameters: ClaudeCliQueryParameters): ClaudeCliQuery {
  return Object.assign(cli.run(parameters), {
    async interrupt() {
      cli.controls.interrupted = true;
    },
    close() {
      cli.controls.closed = true;
    },
  });
}

class FakeClaudeCli implements ClaudeCli {
  readonly controls = { closed: false, interrupted: false };
  queryParameters: ClaudeCliQueryParameters | undefined;
  run: (parameters: ClaudeCliQueryParameters) => AsyncGenerator<ClaudeCliMessage, void> =
    async function* () {
      yield {
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 2, output_tokens: 3 },
        uuid: 'result-1',
        session_id: 'session-1',
      };
    };

  async getSessionInfo() {
    return {
      sessionId: '11111111-1111-4111-8111-111111111111',
      summary: 'Existing session',
      firstPrompt: 'Inspect the app',
      cwd: '/workspace/repo',
      createdAt: 1_700_000_000_000,
      lastModified: 1_700_000_100_000,
    };
  }

  async getSessionMessages() {
    return [
      {
        type: 'user' as const,
        uuid: 'user-1',
        session_id: '11111111-1111-4111-8111-111111111111',
        parent_tool_use_id: null,
        message: { role: 'user', content: [{ type: 'text', text: 'Inspect the app' }] },
      },
      {
        type: 'assistant' as const,
        uuid: 'assistant-1',
        session_id: '11111111-1111-4111-8111-111111111111',
        parent_tool_use_id: null,
        message: { role: 'assistant', content: [{ type: 'text', text: 'Ready.' }] },
      },
      {
        type: 'assistant' as const,
        uuid: 'subagent-1',
        session_id: '11111111-1111-4111-8111-111111111111',
        parent_tool_use_id: 'tool-1',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hidden subagent' }] },
      },
    ];
  }

  async listSessions(options?: { dir?: string }) {
    assert.equal(options?.dir, '/workspace/repo');
    return [(await this.getSessionInfo())!];
  }

  query(parameters: ClaudeCliQueryParameters): ClaudeCliQuery {
    this.queryParameters = parameters;
    return queryFrom(this, parameters);
  }
}

class FakePermissionServerFactory {
  closed = 0;
  private handler: ClaudePermissionHandler | undefined;

  create = async (handler: ClaudePermissionHandler): Promise<ClaudePermissionServer> => {
    this.handler = handler;
    return {
      toolName: 'mcp__panerelay_permission__approve',
      mcpServer: {
        type: 'http',
        url: 'http://127.0.0.1:54321/random/mcp',
        alwaysLoad: true,
      },
      close: async () => {
        this.closed += 1;
      },
    };
  };

  request(
    request: ClaudePermissionToolRequest,
    signal: AbortSignal = new AbortController().signal,
  ) {
    if (!this.handler) throw new Error('Permission server has not started');
    return this.handler(request, signal);
  }
}

function createProvider(cli = new FakeClaudeCli()) {
  const events: ConversationEvent[] = [];
  const browserSessions: string[] = [];
  const permissions = new FakePermissionServerFactory();
  const provider = new ClaudeProvider({
    cli,
    environment: { PANERELAY_BROWSER_ID: 'sidepanel-browser-id' },
    runtimeConfig: async () => ({
      claudePath: '/usr/local/bin/claude',
      claudeVersion: '2.1.206',
      agentBrowserPath: '/usr/local/bin/agent-browser',
      agentBrowserConfigPath: '/Users/test/.panerelay/agent-browser.json',
    }),
    createPermissionServer: permissions.create,
    closeBrowserSession: async session => {
      browserSessions.push(session.label);
    },
  });
  provider.onEvent(event => events.push(event));
  return { browserSessions, cli, events, permissions, provider };
}

async function waitFor(
  predicate: () => boolean,
  message = 'Timed out waiting for Claude provider event',
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error(message);
}

test('exposes Claude Code and normalizes cwd-scoped session history', async () => {
  const { provider } = createProvider();
  const descriptor = await provider.getDescriptor();
  assert.deepEqual(descriptor, {
    id: 'claude',
    name: 'Claude Code',
    status: 'ready',
    description: 'Local Claude Code through the installed Claude Code CLI.',
    version: '2.1.206',
    capabilities: {
      approvals: true,
      imageInput: true,
      interrupt: true,
      listConversations: true,
      resume: true,
      streaming: true,
    },
    setup: {
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      loginCommand: 'claude',
      docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    },
  });

  const conversations = await provider.listConversations('/workspace/repo');
  assert.equal(conversations[0]?.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(conversations[0]?.providerId, 'claude');
  assert.equal(conversations[0]?.title, 'Existing session');

  const resumed = await provider.resumeConversation('11111111-1111-4111-8111-111111111111');
  assert.deepEqual(
    resumed.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Inspect the app'],
      ['assistant', 'Ready.'],
    ],
  );
});

test('keeps missing and incompatible Claude Code optional', async () => {
  for (const config of [
    { agentBrowserConfigPath: '/tmp/agent-browser.json' },
    {
      agentBrowserConfigPath: '/tmp/agent-browser.json',
      claudePath: '/usr/local/bin/claude',
      claudeVersion: '2.0.99',
    },
  ]) {
    const provider = new ClaudeProvider({
      cli: new FakeClaudeCli(),
      runtimeConfig: async () => config,
    });
    const descriptor = await provider.getDescriptor();
    assert.equal(descriptor.status, 'unavailable');
    await assert.rejects(provider.prepare(), /unavailable|incompatible/);
  }
});

test('streams text, reasoning, tool activity, images, usage, and terminal events', async () => {
  const cli = new FakeClaudeCli();
  cli.run = async function* () {
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', thinking: 'Checking' },
      },
      uuid: 'partial-1',
      session_id: 'session-1',
    };
    yield {
      type: 'stream_event',
      parent_tool_use_id: 'subagent-tool',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hidden subagent delta' },
      },
      uuid: 'subagent-partial',
      session_id: 'session-1',
    };
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      },
      uuid: 'partial-2',
      session_id: 'session-1',
    };
    yield {
      type: 'assistant',
      uuid: 'assistant-1',
      session_id: 'session-1',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'pwd' } },
        ],
      },
    };
    yield {
      type: 'tool_progress',
      tool_use_id: 'tool-progress-1',
      tool_name: 'WebFetch',
      elapsed_time_seconds: 1,
    };
    yield {
      type: 'assistant',
      parent_tool_use_id: 'subagent-tool',
      uuid: 'subagent-assistant',
      session_id: 'session-1',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hidden subagent response' }],
      },
    };
    yield {
      type: 'user',
      uuid: 'tool-result-1',
      session_id: 'session-1',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: '/repo' }],
      },
    };
    yield {
      type: 'result',
      subtype: 'success',
      usage: {
        input_tokens: 11,
        output_tokens: 7,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 3,
      },
      uuid: 'result-1',
      session_id: 'session-1',
    };
  };
  const { browserSessions, events, provider } = createProvider(cli);
  const cwd = process.cwd();
  const detail = await provider.startConversation({
    cwd,
    initialPage: { title: 'App', url: 'https://example.com/?token=secret' },
  });
  const conversationId = detail.conversation.id;
  const { turnId } = await provider.sendMessage(conversationId, '', [
    { data: 'AQID', mimeType: 'image/png', name: 'page.png' },
  ]);
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));

  assert.equal(cli.queryParameters?.cwd, cwd);
  assert.equal(cli.queryParameters?.executable, '/usr/local/bin/claude');
  assert.equal(cli.queryParameters?.sessionId, conversationId);
  assert.equal(cli.queryParameters?.resume, undefined);
  assert.match(cli.queryParameters?.systemPrompt ?? '', /App/);
  assert.doesNotMatch(cli.queryParameters?.systemPrompt ?? '', /secret/);
  const browserMcp = cli.queryParameters?.mcpServers?.panerelay_browser;
  assert.equal(browserMcp?.type, 'stdio');
  assert.equal(
    browserMcp && 'command' in browserMcp ? browserMcp.command : undefined,
    '/usr/local/bin/agent-browser',
  );
  assert.equal(
    browserMcp && 'env' in browserMcp ? browserMcp.env?.PANERELAY_BROWSER_ID : undefined,
    'sidepanel-browser-id',
  );
  assert.equal(cli.queryParameters?.permissionPromptTool, 'mcp__panerelay_permission__approve');
  assert.equal(cli.queryParameters?.mcpServers?.panerelay_permission?.type, 'http');
  assert.match(JSON.stringify(cli.queryParameters?.prompt), /image/);
  assert.match(JSON.stringify(cli.queryParameters?.prompt), /AQID/);

  assert.ok(events.some(event => event.kind === 'reasoning.delta' && event.delta === 'Checking'));
  assert.ok(events.some(event => event.kind === 'message.delta' && event.delta === 'Hello'));
  assert.ok(
    !events.some(
      event =>
        (event.kind === 'message.delta' && event.delta.includes('Hidden subagent')) ||
        (event.kind === 'message.completed' && event.message.text.includes('Hidden subagent')),
    ),
  );
  const delta = events.find(event => event.kind === 'message.delta');
  const completedMessage = events.find(event => event.kind === 'message.completed');
  assert.equal(
    delta?.kind === 'message.delta' ? delta.messageId : undefined,
    completedMessage?.kind === 'message.completed' ? completedMessage.message.id : undefined,
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.id === 'tool-1' &&
        event.activity.status === 'completed',
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.id === 'tool-progress-1' &&
        event.activity.status === 'running',
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'usage.updated' &&
        event.inputTokens === 11 &&
        event.outputTokens === 7 &&
        event.contextUsed === 16,
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'turn.completed' && event.turnId === turnId && event.status === 'completed',
    ),
  );
  assert.equal(browserSessions.length, 1);
});

test('correlates one-request MCP approvals and interrupts an active query', async () => {
  const cli = new FakeClaudeCli();
  let release!: () => void;
  cli.run = async function* () {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-1',
      session_id: 'session-1',
    };
  };
  const { events, permissions, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  const conversationId = detail.conversation.id;
  const { turnId } = await provider.sendMessage(conversationId, 'Check status');
  const permissionResult = permissions.request({
    toolName: 'Bash',
    input: { command: 'git status', cwd: '/workspace/repo' },
    toolUseId: 'approval-1',
  });
  await waitFor(() => events.some(event => event.kind === 'approval.requested'));

  await assert.rejects(
    provider.respondToApproval(conversationId, 'approval-1', 'acceptForSession'),
    /one-request/,
  );
  await provider.respondToApproval(conversationId, 'approval-1', 'accept');
  assert.deepEqual(await permissionResult, {
    behavior: 'allow',
    updatedInput: { command: 'git status', cwd: '/workspace/repo' },
  });
  assert.ok(events.some(event => event.kind === 'approval.resolved'));

  const declinedPermission = permissions.request({
    toolName: 'Write',
    input: { file_path: '/workspace/repo/output.txt' },
    toolUseId: 'approval-2',
  });
  await waitFor(() => events.filter(event => event.kind === 'approval.requested').length === 2);
  await provider.respondToApproval(conversationId, 'approval-2', 'decline');
  assert.deepEqual(await declinedPermission, {
    behavior: 'deny',
    message: 'Declined by user',
    interrupt: false,
  });

  const interruptedPermission = permissions.request({
    toolName: 'Bash',
    input: { command: 'pnpm test' },
    toolUseId: 'approval-3',
  });
  await waitFor(() => events.filter(event => event.kind === 'approval.requested').length === 3);
  await provider.interrupt(conversationId, turnId);
  assert.deepEqual(await interruptedPermission, {
    behavior: 'deny',
    message: 'Turn interrupted',
    interrupt: true,
  });
  assert.equal(cli.controls.interrupted, true);
  release();
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));
  assert.ok(
    events.some(event => event.kind === 'turn.completed' && event.status === 'interrupted'),
  );
});

test('fails closed on stale, cancelled, and duplicate MCP permission requests', async () => {
  const cli = new FakeClaudeCli();
  let release!: () => void;
  cli.run = async function* () {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-1',
      session_id: 'session-1',
    };
  };
  const { events, permissions, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Check');
  const controller = new AbortController();
  const pending = permissions.request(
    {
      toolName: 'Bash',
      input: { command: 'pwd' },
      toolUseId: 'approval-1',
    },
    controller.signal,
  );
  await waitFor(() => events.some(event => event.kind === 'approval.requested'));
  assert.deepEqual(
    await permissions.request({
      toolName: 'Bash',
      input: { command: 'pwd' },
      toolUseId: 'approval-1',
    }),
    {
      behavior: 'deny',
      message: 'Duplicate permission request',
    },
  );
  controller.abort();
  assert.deepEqual(await pending, {
    behavior: 'deny',
    message: 'Permission request cancelled',
    interrupt: true,
  });
  await assert.rejects(
    provider.respondToApproval(detail.conversation.id, 'approval-1', 'accept'),
    /no longer pending/,
  );
  release();
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));
});

test('terminates the scoped query when Claude emits an internal control request', async () => {
  const cli = new FakeClaudeCli();
  cli.run = async function* () {
    yield {
      type: 'control_request',
      request_id: 'unexpected-control',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'pwd' },
        tool_use_id: 'approval-without-request',
      },
    };
    await new Promise<void>(() => {});
  };
  const { events, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Check');
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));

  assert.equal(cli.controls.closed, true);
  assert.ok(
    events.some(
      event =>
        event.kind === 'turn.completed' &&
        event.status === 'failed' &&
        event.error?.includes('unsupported internal control request'),
    ),
  );
});

test('cleans up a scoped browser session only once when provider close races turn cleanup', async () => {
  const cli = new FakeClaudeCli();
  let release!: () => void;
  cli.run = async function* () {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-close',
      session_id: 'session-close',
    };
  };
  const { browserSessions, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Wait');
  await waitFor(() => release !== undefined);

  await provider.close();
  assert.equal(cli.controls.closed, true);
  assert.equal(browserSessions.length, 1);
  release();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(browserSessions.length, 1);
});
