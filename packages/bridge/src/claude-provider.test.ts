import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationEvent } from '@panerelay/protocol';
import type {
  ClaudeCli,
  ClaudeCliMessage,
  ClaudeCliQuery,
  ClaudeCliQueryParameters,
} from './claude-cli.js';
import { ClaudeProvider } from './claude-provider.js';

function queryFrom(cli: FakeClaudeCli, parameters: ClaudeCliQueryParameters): ClaudeCliQuery {
  return Object.assign(cli.run(parameters), {
    async interrupt() {
      cli.controls.interrupted = true;
    },
    close() {
      cli.controls.closed = true;
    },
    async respondToControl(requestId: string, response: Record<string, unknown>) {
      cli.controlResponses.push({ requestId, response });
      cli.permissionResult = response;
    },
    async respondToControlError(requestId: string, message: string) {
      cli.controlErrors.push({ message, requestId });
    },
  });
}

class FakeClaudeCli implements ClaudeCli {
  readonly controls = { closed: false, interrupted: false };
  readonly controlErrors: Array<{ message: string; requestId: string }> = [];
  readonly controlResponses: Array<{
    requestId: string;
    response: Record<string, unknown>;
  }> = [];
  permissionResult: unknown;
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

function createProvider(cli = new FakeClaudeCli()) {
  const events: ConversationEvent[] = [];
  const browserSessions: string[] = [];
  const provider = new ClaudeProvider({
    cli,
    runtimeConfig: async () => ({
      claudePath: '/usr/local/bin/claude',
      claudeVersion: '2.1.0',
      agentBrowserPath: '/usr/local/bin/agent-browser',
      agentBrowserConfigPath: '/Users/test/.panerelay/agent-browser.json',
    }),
    closeBrowserSession: async session => {
      browserSessions.push(session.label);
    },
  });
  provider.onEvent(event => events.push(event));
  return { browserSessions, cli, events, provider };
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
    version: '2.1.0',
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
  assert.equal(
    cli.queryParameters?.mcpServers?.panerelay_browser?.command,
    '/usr/local/bin/agent-browser',
  );
  assert.match(JSON.stringify(cli.queryParameters?.prompt), /image/);
  assert.match(JSON.stringify(cli.queryParameters?.prompt), /AQID/);

  assert.ok(events.some(event => event.kind === 'reasoning.delta' && event.delta === 'Checking'));
  assert.ok(events.some(event => event.kind === 'message.delta' && event.delta === 'Hello'));
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

test('correlates one-request stdio approvals and interrupts an active query', async () => {
  const cli = new FakeClaudeCli();
  let release!: () => void;
  cli.run = async function* () {
    yield {
      type: 'control_request',
      request_id: 'request-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'git status', cwd: '/workspace/repo' },
        tool_use_id: 'approval-1',
        title: 'Run git status?',
      },
    };
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
  const { events, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  const conversationId = detail.conversation.id;
  const { turnId } = await provider.sendMessage(conversationId, 'Check status');
  await waitFor(() => events.some(event => event.kind === 'approval.requested'));

  await assert.rejects(
    provider.respondToApproval(conversationId, 'approval-1', 'acceptForSession'),
    /one-request/,
  );
  await provider.respondToApproval(conversationId, 'approval-1', 'accept');
  assert.deepEqual(cli.permissionResult, {
    behavior: 'allow',
    toolUseID: 'approval-1',
  });
  assert.deepEqual(cli.controlResponses[0], {
    requestId: 'request-1',
    response: { behavior: 'allow', toolUseID: 'approval-1' },
  });
  assert.ok(events.some(event => event.kind === 'approval.resolved'));

  await provider.interrupt(conversationId, turnId);
  assert.equal(cli.controls.interrupted, true);
  release();
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));
  assert.ok(
    events.some(event => event.kind === 'turn.completed' && event.status === 'interrupted'),
  );
});

test('fails closed on stale, cancelled, duplicate, and unsupported control requests', async () => {
  const cli = new FakeClaudeCli();
  cli.run = async function* () {
    yield {
      type: 'control_request',
      request_id: 'request-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'pwd' },
        tool_use_id: 'approval-1',
      },
    };
    yield {
      type: 'control_request',
      request_id: 'request-2',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'pwd' },
        tool_use_id: 'approval-1',
      },
    };
    yield { type: 'control_cancel_request', request_id: 'request-1' };
    yield {
      type: 'control_request',
      request_id: 'request-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'pwd' },
        tool_use_id: 'approval-3',
      },
    };
    yield {
      type: 'control_request',
      request_id: 'unsupported-1',
      request: { subtype: 'request_user_dialog' },
    };
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-1',
      session_id: 'session-1',
    };
  };
  const { events, provider } = createProvider(cli);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Check');
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));

  assert.deepEqual(cli.controlResponses[0], {
    requestId: 'request-2',
    response: {
      behavior: 'deny',
      message: 'Duplicate permission request',
      toolUseID: 'approval-1',
    },
  });
  assert.deepEqual(cli.controlResponses[1], {
    requestId: 'request-1',
    response: {
      behavior: 'deny',
      message: 'Duplicate permission request',
      toolUseID: 'approval-3',
    },
  });
  assert.deepEqual(cli.controlErrors, [
    {
      message: 'Unsupported control request subtype: request_user_dialog',
      requestId: 'unsupported-1',
    },
  ]);
  await assert.rejects(
    provider.respondToApproval(detail.conversation.id, 'approval-1', 'accept'),
    /no longer pending/,
  );
});

test('terminates the scoped query when a control request cannot be correlated', async () => {
  const cli = new FakeClaudeCli();
  cli.run = async function* () {
    yield {
      type: 'control_request',
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
        event.error?.includes('without an ID'),
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
