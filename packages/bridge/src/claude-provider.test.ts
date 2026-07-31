import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationEvent } from '@panerelay/protocol';
import type {
  ClaudeAgentSdk,
  ClaudeQueryParameters,
  ClaudeQuery,
  ClaudeSdkMessage,
} from './claude-agent-sdk.js';
import { ClaudeProvider } from './claude-provider.js';

function queryFrom(
  run: (parameters: ClaudeQueryParameters) => AsyncGenerator<ClaudeSdkMessage, void>,
  parameters: ClaudeQueryParameters,
  controls: { closed: boolean; interrupted: boolean },
): ClaudeQuery {
  return Object.assign(run(parameters), {
    async interrupt() {
      controls.interrupted = true;
      return undefined;
    },
    close() {
      controls.closed = true;
    },
  }) as unknown as ClaudeQuery;
}

class FakeClaudeSdk implements ClaudeAgentSdk {
  readonly controls = { closed: false, interrupted: false };
  queryParameters: ClaudeQueryParameters | undefined;
  permissionResult: unknown;
  run: (parameters: ClaudeQueryParameters) => AsyncGenerator<ClaudeSdkMessage, void> =
    async function* () {
      yield {
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 2, output_tokens: 3 },
        uuid: 'result-1',
        session_id: 'session-1',
      } as unknown as ClaudeSdkMessage;
    };

  async getSessionInfo() {
    return {
      sessionId: 'session-existing',
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
        session_id: 'session-existing',
        parent_tool_use_id: null,
        parent_agent_id: null,
        message: { role: 'user', content: [{ type: 'text', text: 'Inspect the app' }] },
      },
      {
        type: 'assistant' as const,
        uuid: 'assistant-1',
        session_id: 'session-existing',
        parent_tool_use_id: null,
        parent_agent_id: null,
        message: { role: 'assistant', content: [{ type: 'text', text: 'Ready.' }] },
      },
      {
        type: 'assistant' as const,
        uuid: 'subagent-1',
        session_id: 'session-existing',
        parent_tool_use_id: 'tool-1',
        parent_agent_id: null,
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hidden subagent' }] },
      },
    ];
  }

  async listSessions(options?: { dir?: string }) {
    assert.equal(options?.dir, '/workspace/repo');
    return [(await this.getSessionInfo())!];
  }

  query(parameters: ClaudeQueryParameters): ClaudeQuery {
    this.queryParameters = parameters;
    return queryFrom(this.run, parameters, this.controls);
  }
}

function createProvider(sdk = new FakeClaudeSdk()) {
  const events: ConversationEvent[] = [];
  const browserSessions: string[] = [];
  const provider = new ClaudeProvider({
    sdk,
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
  return { browserSessions, events, provider, sdk };
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
    description: 'Local Claude Code through the official Claude Agent SDK.',
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
  assert.equal(conversations[0]?.id, 'session-existing');
  assert.equal(conversations[0]?.providerId, 'claude');
  assert.equal(conversations[0]?.title, 'Existing session');

  const resumed = await provider.resumeConversation('session-existing');
  assert.deepEqual(
    resumed.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Inspect the app'],
      ['assistant', 'Ready.'],
    ],
  );
});

test('streams text, reasoning, tool activity, images, usage, and terminal events', async () => {
  const sdk = new FakeClaudeSdk();
  sdk.run = async function* () {
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', thinking: 'Checking' },
      },
      uuid: 'partial-1',
      session_id: 'session-1',
    } as unknown as ClaudeSdkMessage;
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      },
      uuid: 'partial-2',
      session_id: 'session-1',
    } as unknown as ClaudeSdkMessage;
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
    } as unknown as ClaudeSdkMessage;
    yield {
      type: 'user',
      uuid: 'tool-result-1',
      session_id: 'session-1',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: '/repo' }],
      },
    } as unknown as ClaudeSdkMessage;
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
    } as unknown as ClaudeSdkMessage;
  };
  const { browserSessions, events, provider } = createProvider(sdk);
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

  assert.equal(sdk.queryParameters?.options?.cwd, cwd);
  assert.equal(sdk.queryParameters?.options?.pathToClaudeCodeExecutable, '/usr/local/bin/claude');
  assert.equal(sdk.queryParameters?.options?.permissionMode, 'default');
  assert.equal(sdk.queryParameters?.options?.sessionId, conversationId);
  assert.equal(sdk.queryParameters?.options?.resume, undefined);
  assert.match(JSON.stringify(sdk.queryParameters?.options?.systemPrompt), /App/);
  assert.doesNotMatch(JSON.stringify(sdk.queryParameters?.options?.systemPrompt), /secret/);
  assert.equal(
    sdk.queryParameters?.options?.mcpServers?.panerelay_browser &&
      'command' in sdk.queryParameters.options.mcpServers.panerelay_browser
      ? sdk.queryParameters.options.mcpServers.panerelay_browser.command
      : undefined,
    '/usr/local/bin/agent-browser',
  );

  const input: unknown[] = [];
  for await (const message of sdk.queryParameters!.prompt as AsyncIterable<unknown>) {
    input.push(message);
  }
  assert.match(JSON.stringify(input), /image/);
  assert.match(JSON.stringify(input), /AQID/);

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

test('correlates one-request approvals and interrupts an active query', async () => {
  const sdk = new FakeClaudeSdk();
  let release!: () => void;
  sdk.run = async function* (parameters) {
    const permission = await parameters.options!.canUseTool!(
      'Bash',
      { command: 'git status', cwd: '/workspace/repo' },
      {
        signal: new AbortController().signal,
        toolUseID: 'approval-1',
        requestId: 'request-1',
        title: 'Run git status?',
      },
    );
    sdk.permissionResult = permission;
    await new Promise<void>(resolve => {
      release = resolve;
    });
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-1',
      session_id: 'session-1',
    } as unknown as ClaudeSdkMessage;
  };
  const { events, provider } = createProvider(sdk);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  const conversationId = detail.conversation.id;
  const { turnId } = await provider.sendMessage(conversationId, 'Check status');
  await waitFor(() => events.some(event => event.kind === 'approval.requested'));

  await provider.respondToApproval(conversationId, 'approval-1', 'accept');
  await waitFor(() => sdk.permissionResult !== undefined);
  assert.deepEqual(sdk.permissionResult, {
    behavior: 'allow',
    toolUseID: 'approval-1',
  });
  assert.ok(events.some(event => event.kind === 'approval.resolved'));

  await provider.interrupt(conversationId, turnId);
  assert.equal(sdk.controls.interrupted, true);
  release();
  await waitFor(() => events.some(event => event.kind === 'turn.completed'));
  assert.ok(
    events.some(event => event.kind === 'turn.completed' && event.status === 'interrupted'),
  );
});

test('fails closed on stale and session-wide approval decisions', async () => {
  const { provider } = createProvider();
  await assert.rejects(
    provider.respondToApproval('missing', 'missing', 'accept'),
    /no longer pending/,
  );
});

test('denies an already-aborted tool request without publishing a stale approval', async () => {
  const sdk = new FakeClaudeSdk();
  sdk.run = async function* (parameters) {
    const controller = new AbortController();
    controller.abort();
    sdk.permissionResult = await parameters.options!.canUseTool!(
      'Bash',
      { command: 'pwd' },
      {
        signal: controller.signal,
        toolUseID: 'aborted-tool',
        requestId: 'aborted-request',
      },
    );
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-aborted',
      session_id: 'session-aborted',
    } as unknown as ClaudeSdkMessage;
  };
  const { events, provider } = createProvider(sdk);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Check');
  await waitFor(() => sdk.permissionResult !== undefined);

  assert.deepEqual(sdk.permissionResult, {
    behavior: 'deny',
    message: 'Permission request was already cancelled',
    toolUseID: 'aborted-tool',
  });
  assert.equal(
    events.some(event => event.kind === 'approval.requested'),
    false,
  );
});

test('cleans up a scoped browser session only once when provider close races turn cleanup', async () => {
  const sdk = new FakeClaudeSdk();
  let release!: () => void;
  sdk.run = async function* () {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    yield {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
      uuid: 'result-close',
      session_id: 'session-close',
    } as unknown as ClaudeSdkMessage;
  };
  const { browserSessions, provider } = createProvider(sdk);
  const detail = await provider.startConversation({ cwd: process.cwd() });
  await provider.sendMessage(detail.conversation.id, 'Wait');
  await waitFor(() => release !== undefined);

  await provider.close();
  assert.equal(browserSessions.length, 1);
  release();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(browserSessions.length, 1);
});
