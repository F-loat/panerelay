import assert from 'node:assert/strict';
import test from 'node:test';
import * as acp from '@agentclientprotocol/sdk';
import type { ConversationEvent } from '@panerelay/protocol';
import {
  PANERELAY_CONTEXT_END,
  PANERELAY_CONTEXT_START,
  wrapAcpConversationContext,
} from './acp-context.js';
import {
  OpenCodeProvider,
  type OpenCodeProviderOptions,
  type OpenCodeRuntime,
} from './opencode-provider.js';

class FakeOpenCodeRuntime implements OpenCodeRuntime {
  readonly notifications: Array<{ method: string; params: unknown }> = [];
  readonly requests: Array<{ method: string; params: unknown }> = [];
  closed = false;
  historyAnswer: string | null = 'Earlier answer';
  historyChunks = ['Earlier question'];
  prompt: ((params: unknown) => Promise<acp.PromptResponse>) | undefined;

  constructor(
    readonly handlers: Parameters<NonNullable<OpenCodeProviderOptions['createRuntime']>>[1],
    readonly initializeResponse: acp.InitializeResponse = {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentInfo: { name: 'opencode-cli', title: 'OpenCode CLI', version: '1.18.12' },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: { image: true, embeddedContext: true },
        sessionCapabilities: { list: {}, resume: {}, close: {} },
      },
    },
  ) {}

  async start(): Promise<acp.InitializeResponse> {
    return this.initializeResponse;
  }

  async request(method: string, params: unknown): Promise<unknown> {
    this.requests.push({ method, params });
    if (method === acp.methods.agent.session.list) {
      return {
        sessions: [
          {
            sessionId: 'opencode-existing',
            cwd: '/listed-workspace',
            title: 'Existing OpenCode session',
            updatedAt: '2026-07-30T00:00:00.000Z',
          },
        ],
      } satisfies acp.ListSessionsResponse;
    }
    if (method === acp.methods.agent.session.new) {
      return {
        sessionId: 'opencode-new',
        configOptions: [
          {
            id: 'model',
            name: 'Model',
            category: 'model',
            type: 'select',
            currentValue: 'opencode/model-new',
            options: [{ value: 'opencode/model-new', name: 'OpenCode Model New' }],
          },
        ],
      } satisfies acp.NewSessionResponse;
    }
    if (method === acp.methods.agent.session.load) {
      const sessionId = (params as acp.LoadSessionRequest).sessionId;
      for (const text of this.historyChunks) {
        this.handlers.onUpdate({
          sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            messageId: 'user-1',
            content: { type: 'text', text },
          },
        });
      }
      if (this.historyAnswer !== null) {
        this.handlers.onUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-1',
            content: { type: 'text', text: this.historyAnswer },
          },
        });
      }
      return {
        configOptions: [
          {
            id: 'model',
            name: 'Model',
            category: 'model',
            type: 'select',
            currentValue: 'opencode/model-existing',
            options: [{ value: 'opencode/model-existing', name: 'OpenCode Model Existing' }],
          },
        ],
      } satisfies acp.LoadSessionResponse;
    }
    if (method === acp.methods.agent.session.prompt && this.prompt) {
      return this.prompt(params);
    }
    if (method === acp.methods.agent.session.prompt) {
      return {
        stopReason: 'end_turn',
        usage: { totalTokens: 5, inputTokens: 3, outputTokens: 2 },
      } satisfies acp.PromptResponse;
    }
    return {};
  }

  async notify(method: string, params: unknown): Promise<void> {
    this.notifications.push({ method, params });
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function harness(
  initializeResponse?: acp.InitializeResponse,
  overrides: Partial<OpenCodeProviderOptions> = {},
) {
  const events: ConversationEvent[] = [];
  const diagnostics: string[] = [];
  const runtimes: FakeOpenCodeRuntime[] = [];
  const provider = new OpenCodeProvider({
    cwd: () => '/workspace',
    onDiagnostic: message => diagnostics.push(message),
    runtimeConfig: async () => ({
      opencodePath: 'C:\\OpenCode\\opencode.cmd',
      opencodeVersion: '1.18.12',
    }),
    resolveExecutable: async () => ({
      executable: 'C:\\OpenCode\\opencode.cmd',
      version: '1.18.12',
    }),
    createRuntime: (_executable, handlers) => {
      const runtime = new FakeOpenCodeRuntime(handlers, initializeResponse);
      runtimes.push(runtime);
      return runtime;
    },
    ...overrides,
  });
  provider.onEvent(event => events.push(event));
  return { diagnostics, events, provider, runtimes };
}

async function flush(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
}

test('reports missing OpenCode without blocking and exposes negotiated capabilities when ready', async () => {
  const unavailable = new OpenCodeProvider({
    platform: 'win32',
    runtimeConfig: async () => ({}),
    resolveExecutable: async () => ({ error: 'OpenCode CLI was not found' }),
  });
  const missing = await unavailable.getDescriptor();
  assert.equal(missing.status, 'unavailable');
  assert.match(missing.setupHint || '', /OpenCode CLI was not found/);
  assert.deepEqual(missing.setup, {
    installCommand: 'npm install -g opencode-ai',
    loginCommand: 'opencode auth login',
    docsUrl: 'https://opencode.ai/docs/acp/',
  });

  const { provider, runtimes } = harness();
  const descriptor = await provider.getDescriptor();
  assert.equal(descriptor.status, 'ready');
  assert.equal(descriptor.version, '1.18.12');
  assert.equal(descriptor.setup?.loginCommand, 'opencode auth login');
  assert.equal(runtimes.length, 0);
  assert.deepEqual(descriptor.capabilities, {
    approvals: true,
    imageInput: false,
    interrupt: true,
    listConversations: false,
    resume: false,
    streaming: true,
  });

  await provider.prepare();
  const preparedDescriptor = await provider.getDescriptor();
  assert.equal(runtimes.length, 1);
  assert.deepEqual(preparedDescriptor.capabilities, {
    approvals: true,
    imageInput: true,
    interrupt: true,
    listConversations: true,
    resume: true,
    streaming: true,
  });
});

test('deduplicates concurrent OpenCode preparation and retries after startup failure', async () => {
  let starts = 0;
  let creations = 0;
  let releaseStart!: () => void;
  const barrier = new Promise<void>(resolve => {
    releaseStart = resolve;
  });
  const provider = new OpenCodeProvider({
    runtimeConfig: async () => ({
      opencodePath: '/bin/opencode',
    }),
    resolveExecutable: async () => ({ executable: '/bin/opencode', version: '1.18.12' }),
    createRuntime: (_executable, handlers) => {
      creations += 1;
      const runtime = new FakeOpenCodeRuntime(handlers);
      const originalStart = runtime.start.bind(runtime);
      runtime.start = async () => {
        starts += 1;
        if (creations === 1) throw new Error('temporary startup failure');
        await barrier;
        return originalStart();
      };
      return runtime;
    },
  });

  await assert.rejects(provider.prepare(), /temporary startup failure/);
  const first = provider.prepare();
  const second = provider.prepare();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(creations, 2);
  assert.equal(starts, 2);

  releaseStart();
  await Promise.all([first, second]);
  await provider.prepare();
  assert.equal(creations, 2);
  assert.equal(starts, 2);
});

test('lists, starts, and loads OpenCode sessions without injecting browser MCP definitions', async () => {
  const { provider, runtimes } = harness();
  const conversations = await provider.listConversations('/workspace/project');
  assert.equal(conversations[0]?.id, 'opencode-existing');
  assert.equal(conversations[0]?.providerId, 'opencode');
  const listRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.list,
  );
  assert.deepEqual(listRequest?.params, {
    cursor: null,
    cwd: '/workspace/project',
  });

  const started = await provider.startConversation();
  assert.equal(started.conversation.id, 'opencode-new');
  assert.equal(started.conversation.model, 'OpenCode Model New');
  const newRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.new,
  );
  const newParams = newRequest?.params as acp.NewSessionRequest;
  assert.deepEqual(newParams.mcpServers, []);

  const persistedPrompt = wrapAcpConversationContext(
    'private Panerelay context',
    'Earlier question',
  );
  runtimes[0]!.historyChunks = [persistedPrompt.slice(0, 19), persistedPrompt.slice(19)];
  const resumed = await provider.resumeConversation('opencode-existing');
  assert.equal(resumed.conversation.model, 'OpenCode Model Existing');
  assert.deepEqual(
    resumed.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Earlier question'],
      ['assistant', 'Earlier answer'],
    ],
  );
  const loadRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.load,
  );
  const loadParams = loadRequest?.params as acp.LoadSessionRequest;
  assert.deepEqual(loadParams.mcpServers, []);
  assert.equal(loadParams.cwd, '/listed-workspace');
  await provider.close();
  assert.ok(
    runtimes[0]?.requests.some(request => request.method === acp.methods.agent.session.close),
  );
});

test('restores retained OpenCode messages only when session load history is empty', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation();
  const runtime = runtimes[0]!;
  runtime.prompt = async () => {
    runtime.handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'assistant-live',
        content: { type: 'text', text: 'Live answer' },
      },
    });
    return { stopReason: 'end_turn' } satisfies acp.PromptResponse;
  };
  await provider.sendMessage('opencode-new', 'Live question');
  await flush();

  runtime.historyChunks = [];
  runtime.historyAnswer = null;
  const fallback = await provider.resumeConversation('opencode-new');
  assert.deepEqual(
    fallback.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Live question'],
      ['assistant', 'Live answer'],
    ],
  );

  runtime.historyChunks = ['Provider question'];
  runtime.historyAnswer = 'Provider answer';
  const providerHistory = await provider.resumeConversation('opencode-new');
  assert.deepEqual(
    providerHistory.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Provider question'],
      ['assistant', 'Provider answer'],
    ],
  );
});

test('uses a validated project and prepends bounded page context only to the first prompt', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation({
    cwd: process.cwd(),
    initialPage: {
      url: 'https://example.com/app?token=secret',
      title: 'Example app',
      target: {
        browserId: '11111111-1111-4111-8111-111111111111',
        targetId: '22222222-2222-4222-8222-222222222222',
      },
    },
  });
  await provider.sendMessage('opencode-new', 'Inspect this page');
  await flush();

  const newRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.new,
  );
  assert.equal((newRequest?.params as acp.NewSessionRequest).cwd, process.cwd());
  const firstPrompt = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.prompt,
  )?.params as acp.PromptRequest;
  const firstText = firstPrompt.prompt[0];
  assert.equal(firstText?.type, 'text');
  const firstPromptText = firstText?.type === 'text' ? firstText.text : '';
  assert.ok(firstPromptText.startsWith(`${PANERELAY_CONTEXT_START}\n`));
  assert.ok(firstPromptText.includes(`${PANERELAY_CONTEXT_END}\n\nInspect this page`));
  assert.equal(firstPromptText.split(PANERELAY_CONTEXT_START).length - 1, 1);
  assert.equal(firstPromptText.split(PANERELAY_CONTEXT_END).length - 1, 1);
  assert.match(firstPromptText, /Example app/);
  assert.match(firstPromptText, /panerelay-v2-[A-Za-z0-9_-]{43}/);
  assert.match(firstPromptText, /switch_tab/);
  assert.match(firstPromptText, /tab-select 0/);
  assert.doesNotMatch(firstPromptText, /secret/);
  assert.doesNotMatch(firstPromptText, /"tabId"|panerelay_browser|browser tool|projectDirectory/i);

  await provider.sendMessage('opencode-new', 'Continue');
  await flush();
  const prompts = runtimes[0]?.requests.filter(
    request => request.method === acp.methods.agent.session.prompt,
  );
  const secondText = (prompts?.[1]?.params as acp.PromptRequest).prompt[0];
  assert.equal(secondText?.type === 'text' ? secondText.text : '', 'Continue');

  await provider.sendMessage('opencode-new', '', [
    { data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' },
  ]);
  await flush();
  const imagePrompt = (
    runtimes[0]?.requests.filter(request => request.method === acp.methods.agent.session.prompt)[2]
      ?.params as acp.PromptRequest
  ).prompt;
  assert.deepEqual(imagePrompt, [{ type: 'image', data: 'AQID', mimeType: 'image/png' }]);
});

test('keeps context before an image-only first prompt', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation();
  await provider.sendMessage('opencode-new', '', [
    { data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' },
  ]);
  await flush();

  const request = runtimes[0]?.requests.find(
    item => item.method === acp.methods.agent.session.prompt,
  );
  const prompt = (request?.params as acp.PromptRequest).prompt;
  assert.equal(prompt[0]?.type, 'text');
  assert.ok(
    prompt[0]?.type === 'text' &&
      prompt[0].text.startsWith(`${PANERELAY_CONTEXT_START}\n`) &&
      prompt[0].text.endsWith(`\n${PANERELAY_CONTEXT_END}`),
  );
  assert.deepEqual(prompt[1], { type: 'image', data: 'AQID', mimeType: 'image/png' });
  await provider.close();
});

test('normalizes streaming, reasoning, plan, tools, usage, completion, and unknown updates', async () => {
  const { diagnostics, events, provider, runtimes } = harness();
  await provider.startConversation();
  runtimes[0]!.prompt = async () => {
    const handlers = runtimes[0]!.handlers;
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'commentary-1',
        content: { type: 'text', text: 'I will inspect first.' },
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'agent_thought_chunk',
        messageId: 'thought-1',
        content: { type: 'text', text: 'Thinking' },
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'plan',
        entries: [{ content: 'Inspect', priority: 'high', status: 'in_progress' }],
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Panerelay browser snapshot',
        kind: 'fetch',
        status: 'in_progress',
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        title: 'Panerelay browser snapshot',
        status: 'failed',
        content: [
          {
            type: 'content',
            content: {
              type: 'text',
              text: 'CDP error: all-tabs authorization is required',
            },
          },
          {
            type: 'content',
            content: {
              type: 'image',
              data: 'not-displayed',
              mimeType: 'image/png',
            },
          },
        ],
        rawOutput: {
          secret: 'must not be rendered',
        },
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-bounded',
        status: 'failed',
        content: [
          {
            type: 'content',
            content: {
              type: 'text',
              text: 'x'.repeat(9_000),
            },
          },
        ],
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'usage_update',
        used: 100,
        size: 10_000,
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [],
      },
    });
    handlers.onUpdate({
      sessionId: 'opencode-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'message-1',
        content: { type: 'text', text: 'Done' },
      },
    });
    return {
      stopReason: 'end_turn',
      usage: { totalTokens: 20, inputTokens: 12, outputTokens: 8 },
    };
  };

  await provider.sendMessage('opencode-new', 'Inspect the page');
  await flush();
  assert.ok(events.some(event => event.kind === 'reasoning.delta'));
  assert.ok(
    events.some(event => event.kind === 'activity.updated' && event.activity.kind === 'browser'),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.status === 'failed' &&
        event.activity.detail === 'CDP error: all-tabs authorization is required',
    ),
  );
  assert.ok(!JSON.stringify(events).includes('must not be rendered'));
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.id === 'tool-bounded' &&
        event.activity.detail?.length === 8 * 1024,
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'usage.updated' && event.contextUsed === 100 && event.contextSize === 10_000,
    ),
  );
  const messageDeltas = events.filter(event => event.kind === 'message.delta');
  assert.deepEqual(
    messageDeltas.map(event =>
      event.kind === 'message.delta' ? [event.messageId, event.delta] : [],
    ),
    [
      ['commentary-1', 'I will inspect first.'],
      ['message-1', 'Done'],
    ],
  );
  const completedMessages = events.filter(event => event.kind === 'message.completed');
  assert.deepEqual(
    completedMessages.map(event =>
      event.kind === 'message.completed' ? [event.message.id, event.message.text] : [],
    ),
    [
      ['commentary-1', 'I will inspect first.'],
      ['message-1', 'Done'],
    ],
  );
  const firstActivityIndex = events.findIndex(
    event => event.kind === 'activity.updated' && event.activity.id === 'tool-1',
  );
  const finalDeltaIndex = events.findIndex(
    event => event.kind === 'message.delta' && event.messageId === 'message-1',
  );
  assert.ok(firstActivityIndex >= 0 && finalDeltaIndex > firstActivityIndex);
  assert.ok(events.some(event => event.kind === 'turn.completed' && event.status === 'completed'));
  assert.deepEqual(diagnostics, ['Ignored OpenCode update: available_commands_update']);
});

test('keeps ACP assistant chunks together when the provider omits a message ID', async () => {
  const { events, provider, runtimes } = harness();
  await provider.startConversation();
  runtimes[0]!.prompt = async () => {
    const handlers = runtimes[0]!.handlers;
    for (const text of ['Fallback ', 'message']) {
      handlers.onUpdate({
        sessionId: 'opencode-new',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text },
        },
      });
    }
    return { stopReason: 'end_turn' } satisfies acp.PromptResponse;
  };

  await provider.sendMessage('opencode-new', 'Use the fallback');
  await flush();

  const deltas = events.filter(event => event.kind === 'message.delta');
  assert.equal(deltas.length, 2);
  assert.equal(
    deltas[0]?.kind === 'message.delta' ? deltas[0].messageId : '',
    deltas[1]?.kind === 'message.delta' ? deltas[1].messageId : '',
  );
  const completions = events.filter(event => event.kind === 'message.completed');
  assert.deepEqual(
    completions.map(event => (event.kind === 'message.completed' ? event.message.text : '')),
    ['Fallback message'],
  );
  await provider.close();
});

test('keeps ACP option IDs private and cancels pending permission on interruption', async () => {
  const { events, provider, runtimes } = harness();
  await provider.startConversation();
  let completePrompt!: (value: acp.PromptResponse) => void;
  let permissionResult: acp.RequestPermissionResponse | undefined;
  runtimes[0]!.prompt = async () => {
    const permission = runtimes[0]!.handlers.onPermission(71, {
      sessionId: 'opencode-new',
      toolCall: {
        toolCallId: 'tool-approval',
        title: 'Run a bounded command',
        kind: 'execute',
        status: 'pending',
      },
      options: [
        { optionId: 'provider-secret-allow', name: 'Allow once', kind: 'allow_once' },
        {
          optionId: 'provider-secret-reject',
          name: 'Reject always',
          kind: 'reject_always',
        },
      ],
    });
    permission.then(value => {
      permissionResult = value;
    });
    return new Promise(resolve => {
      completePrompt = resolve;
    });
  };

  await provider.sendMessage('opencode-new', 'Use a tool');
  await flush();
  const requested = events.find(event => event.kind === 'approval.requested');
  assert.ok(requested && requested.kind === 'approval.requested');
  assert.deepEqual(requested.approval.decisions, ['accept', 'declineForSession', 'cancel']);
  assert.doesNotMatch(JSON.stringify(requested), /provider-secret/);
  await provider.respondToApproval('opencode-new', requested.approval.id, 'accept');
  await flush();
  assert.deepEqual(permissionResult, {
    outcome: { outcome: 'selected', optionId: 'provider-secret-allow' },
  });
  completePrompt({ stopReason: 'end_turn' });
  await flush();

  let cancelPrompt!: (value: acp.PromptResponse) => void;
  runtimes[0]!.prompt = async () => {
    const permission = runtimes[0]!.handlers.onPermission(72, {
      sessionId: 'opencode-new',
      toolCall: {
        toolCallId: 'tool-cancel',
        title: 'Another tool',
        kind: 'other',
        status: 'pending',
      },
      options: [{ optionId: 'provider-secret-2', name: 'Allow', kind: 'allow_once' }],
    });
    permission.then(value => {
      permissionResult = value;
    });
    return new Promise(resolve => {
      cancelPrompt = resolve;
    });
  };
  const interrupted = await provider.sendMessage('opencode-new', 'Interrupt this');
  await flush();
  await provider.interrupt('opencode-new', interrupted.turnId);
  cancelPrompt({ stopReason: 'cancelled' });
  await flush();
  assert.deepEqual(permissionResult, { outcome: { outcome: 'cancelled' } });
  assert.equal(runtimes[0]?.notifications[0]?.method, acp.methods.agent.session.cancel);
  assert.equal(
    events.filter(
      event =>
        event.kind === 'turn.completed' &&
        event.turnId === interrupted.turnId &&
        event.status === 'interrupted',
    ).length,
    1,
  );
  await provider.close();
});

test('fails unsupported capabilities and reports an ACP process exit', async () => {
  const initializeResponse: acp.InitializeResponse = {
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { promptCapabilities: { image: false } },
  };
  const { events, provider, runtimes } = harness(initializeResponse);
  await assert.rejects(provider.listConversations(), /does not advertise ACP session listing/);
  await assert.rejects(
    provider.resumeConversation('missing'),
    /does not advertise ACP session resume or load/,
  );

  await provider.startConversation();
  let completeLatePrompt!: (value: acp.PromptResponse) => void;
  runtimes[0]!.prompt = async () =>
    new Promise(resolve => {
      completeLatePrompt = resolve;
    });
  const { turnId } = await provider.sendMessage('opencode-new', 'Keep running');
  runtimes[0]!.handlers.onExit('OpenCode ACP exited (code=1, signal=null)');
  completeLatePrompt({ stopReason: 'end_turn' });
  await flush();
  assert.equal(
    events.filter(event => event.kind === 'turn.completed' && event.turnId === turnId).length,
    1,
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'turn.completed' && event.turnId === turnId && event.status === 'failed',
    ),
  );
  const descriptor = await provider.getDescriptor();
  assert.equal(descriptor.status, 'ready');
  assert.equal(runtimes.length, 1);
  await provider.startConversation();
  assert.equal(runtimes.length, 2);
  await provider.close();
  assert.equal(runtimes[1]?.closed, true);
});

test('allows prompts to outlive control timeouts and leaves the provider reusable', async () => {
  const { events, provider, runtimes } = harness(undefined, { requestTimeoutMs: 5 });
  await provider.startConversation();
  let completePrompt!: (value: acp.PromptResponse) => void;
  runtimes[0]!.prompt = async () =>
    new Promise(resolve => {
      completePrompt = resolve;
    });
  const { turnId } = await provider.sendMessage('opencode-new', 'Keep working');
  await new Promise<void>(resolve => setTimeout(resolve, 15));
  assert.equal(
    events.some(event => event.kind === 'turn.completed' && event.turnId === turnId),
    false,
  );
  await assert.rejects(
    provider.sendMessage('opencode-new', 'Do not overlap'),
    /current OpenCode turn has not finished/,
  );
  runtimes[0]!.handlers.onUpdate({
    sessionId: 'opencode-new',
    update: {
      sessionUpdate: 'agent_message_chunk',
      messageId: 'late-message',
      content: { type: 'text', text: 'Finished after the control timeout' },
    },
  });
  completePrompt({ stopReason: 'end_turn' });
  await flush();
  assert.ok(
    events.some(
      event =>
        event.kind === 'turn.completed' && event.turnId === turnId && event.status === 'completed',
    ),
  );
  runtimes[0]!.prompt = undefined;
  await provider.sendMessage('opencode-new', 'Try again');
  await flush();
  assert.ok(events.some(event => event.kind === 'turn.completed' && event.status === 'completed'));
  await provider.close();
});

test('cancels an active prompt on shutdown and ignores late settlement', async () => {
  const { events, provider, runtimes } = harness();
  await provider.startConversation();
  let completePrompt!: (value: acp.PromptResponse) => void;
  runtimes[0]!.prompt = async () =>
    new Promise(resolve => {
      completePrompt = resolve;
    });
  const { turnId } = await provider.sendMessage('opencode-new', 'Keep working');
  await flush();
  await provider.close();
  completePrompt({ stopReason: 'end_turn' });
  await flush();

  assert.ok(
    runtimes[0]?.notifications.some(
      notification => notification.method === acp.methods.agent.session.cancel,
    ),
  );
  assert.equal(runtimes[0]?.closed, true);
  assert.deepEqual(
    events.filter(event => event.kind === 'turn.completed' && event.turnId === turnId),
    [
      {
        kind: 'turn.completed',
        conversationId: 'opencode-new',
        turnId,
        status: 'interrupted',
      },
    ],
  );
});
