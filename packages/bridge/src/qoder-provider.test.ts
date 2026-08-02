import assert from 'node:assert/strict';
import test from 'node:test';
import * as acp from '@agentclientprotocol/sdk';
import type { ConversationEvent } from '@panerelay/protocol';
import { QoderProvider, type QoderProviderOptions, type QoderRuntime } from './qoder-provider.js';

class FakeQoderRuntime implements QoderRuntime {
  readonly notifications: Array<{ method: string; params: unknown }> = [];
  readonly requests: Array<{ method: string; params: unknown }> = [];
  closed = false;
  prompt: ((params: unknown) => Promise<acp.PromptResponse>) | undefined;

  constructor(
    readonly handlers: Parameters<NonNullable<QoderProviderOptions['createRuntime']>>[1],
    readonly initializeResponse: acp.InitializeResponse = {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentInfo: { name: 'qoder-cli', title: 'Qoder CLI', version: '1.1.2' },
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
            sessionId: 'qoder-existing',
            cwd: '/workspace',
            title: 'Existing Qoder session',
            updatedAt: '2026-07-30T00:00:00.000Z',
          },
        ],
      } satisfies acp.ListSessionsResponse;
    }
    if (method === acp.methods.agent.session.new) {
      return { sessionId: 'qoder-new', configOptions: [] } satisfies acp.NewSessionResponse;
    }
    if (method === acp.methods.agent.session.load) {
      this.handlers.onUpdate({
        sessionId: 'qoder-existing',
        update: {
          sessionUpdate: 'user_message_chunk',
          messageId: 'user-1',
          content: { type: 'text', text: 'Earlier question' },
        },
      });
      this.handlers.onUpdate({
        sessionId: 'qoder-existing',
        update: {
          sessionUpdate: 'agent_message_chunk',
          messageId: 'assistant-1',
          content: { type: 'text', text: 'Earlier answer' },
        },
      });
      return { configOptions: [] } satisfies acp.LoadSessionResponse;
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
  overrides: Partial<QoderProviderOptions> = {},
) {
  const events: ConversationEvent[] = [];
  const diagnostics: string[] = [];
  const runtimes: FakeQoderRuntime[] = [];
  const provider = new QoderProvider({
    cwd: () => '/workspace',
    onDiagnostic: message => diagnostics.push(message),
    runtimeConfig: async () => ({
      qoderPath: 'C:\\Qoder\\qodercli.cmd',
      qoderVersion: '1.1.2',
    }),
    resolveExecutable: async () => ({
      executable: 'C:\\Qoder\\qodercli.cmd',
      version: '1.1.2',
    }),
    createRuntime: (_executable, handlers) => {
      const runtime = new FakeQoderRuntime(handlers, initializeResponse);
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

test('reports missing Qoder without blocking and exposes negotiated capabilities when ready', async () => {
  const unavailable = new QoderProvider({
    platform: 'win32',
    runtimeConfig: async () => ({}),
    resolveExecutable: async () => ({ error: 'Qoder CLI was not found' }),
  });
  const missing = await unavailable.getDescriptor();
  assert.equal(missing.status, 'unavailable');
  assert.match(missing.setupHint || '', /Qoder CLI was not found/);
  assert.deepEqual(missing.setup, {
    installCommand: 'npm install -g @qoder-ai/qodercli',
    loginCommand: 'qodercli',
    docsUrl: 'https://docs.qoder.com/en/cli/quick-start',
  });

  const { provider, runtimes } = harness();
  const descriptor = await provider.getDescriptor();
  assert.equal(descriptor.status, 'ready');
  assert.equal(descriptor.version, '1.1.2');
  assert.equal(descriptor.setup?.loginCommand, 'qodercli');
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

test('deduplicates concurrent Qoder preparation and retries after startup failure', async () => {
  let starts = 0;
  let creations = 0;
  let releaseStart!: () => void;
  const barrier = new Promise<void>(resolve => {
    releaseStart = resolve;
  });
  const provider = new QoderProvider({
    runtimeConfig: async () => ({
      qoderPath: '/bin/qodercli',
    }),
    resolveExecutable: async () => ({ executable: '/bin/qodercli', version: '1.1.2' }),
    createRuntime: (_executable, handlers) => {
      creations += 1;
      const runtime = new FakeQoderRuntime(handlers);
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

test('lists, starts, and loads Qoder sessions without injecting browser MCP definitions', async () => {
  const { provider, runtimes } = harness();
  const conversations = await provider.listConversations('/workspace/project');
  assert.equal(conversations[0]?.id, 'qoder-existing');
  assert.equal(conversations[0]?.providerId, 'qoder');
  const listRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.list,
  );
  assert.deepEqual(listRequest?.params, {
    cursor: null,
    cwd: '/workspace/project',
  });

  const started = await provider.startConversation();
  assert.equal(started.conversation.id, 'qoder-new');
  const newRequest = runtimes[0]?.requests.find(
    request => request.method === acp.methods.agent.session.new,
  );
  const newParams = newRequest?.params as acp.NewSessionRequest;
  assert.deepEqual(newParams.mcpServers, []);

  const resumed = await provider.resumeConversation('qoder-existing');
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
  await provider.close();
  assert.ok(
    runtimes[0]?.requests.some(request => request.method === acp.methods.agent.session.close),
  );
});

test('uses a validated project and prepends bounded page context only to the first prompt', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation({
    cwd: process.cwd(),
    initialPage: {
      url: 'https://example.com/app?token=secret',
      title: 'Example app',
    },
  });
  await provider.sendMessage('qoder-new', 'Inspect this page');
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
  assert.match(firstText?.type === 'text' ? firstText.text : '', /Example app/);
  assert.match(firstText?.type === 'text' ? firstText.text : '', /Inspect this page/);
  assert.doesNotMatch(firstText?.type === 'text' ? firstText.text : '', /secret/);
  assert.doesNotMatch(
    firstText?.type === 'text' ? firstText.text : '',
    /"tabId"|panerelay_browser|browser tool|projectDirectory/i,
  );

  await provider.sendMessage('qoder-new', 'Continue');
  await flush();
  const prompts = runtimes[0]?.requests.filter(
    request => request.method === acp.methods.agent.session.prompt,
  );
  const secondText = (prompts?.[1]?.params as acp.PromptRequest).prompt[0];
  assert.equal(secondText?.type === 'text' ? secondText.text : '', 'Continue');

  await provider.sendMessage('qoder-new', '', [
    { data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' },
  ]);
  await flush();
  const imagePrompt = (
    runtimes[0]?.requests.filter(request => request.method === acp.methods.agent.session.prompt)[2]
      ?.params as acp.PromptRequest
  ).prompt;
  assert.deepEqual(imagePrompt, [{ type: 'image', data: 'AQID', mimeType: 'image/png' }]);
});

test('normalizes streaming, reasoning, plan, tools, usage, completion, and unknown updates', async () => {
  const { diagnostics, events, provider, runtimes } = harness();
  await provider.startConversation();
  runtimes[0]!.prompt = async () => {
    const handlers = runtimes[0]!.handlers;
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'agent_thought_chunk',
        messageId: 'thought-1',
        content: { type: 'text', text: 'Thinking' },
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'plan',
        entries: [{ content: 'Inspect', priority: 'high', status: 'in_progress' }],
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Panerelay browser snapshot',
        kind: 'fetch',
        status: 'in_progress',
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
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
      sessionId: 'qoder-new',
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
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'usage_update',
        used: 100,
        size: 10_000,
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [],
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
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

  await provider.sendMessage('qoder-new', 'Inspect the page');
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
  assert.ok(events.some(event => event.kind === 'message.completed'));
  assert.ok(events.some(event => event.kind === 'turn.completed' && event.status === 'completed'));
  assert.deepEqual(diagnostics, ['Ignored Qoder update: available_commands_update']);
});

test('keeps ACP option IDs private and cancels pending permission on interruption', async () => {
  const { events, provider, runtimes } = harness();
  await provider.startConversation();
  let completePrompt!: (value: acp.PromptResponse) => void;
  let permissionResult: acp.RequestPermissionResponse | undefined;
  runtimes[0]!.prompt = async () => {
    const permission = runtimes[0]!.handlers.onPermission(71, {
      sessionId: 'qoder-new',
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

  const { turnId } = await provider.sendMessage('qoder-new', 'Use a tool');
  await flush();
  const requested = events.find(event => event.kind === 'approval.requested');
  assert.ok(requested && requested.kind === 'approval.requested');
  assert.deepEqual(requested.approval.decisions, ['accept', 'declineForSession', 'cancel']);
  assert.doesNotMatch(JSON.stringify(requested), /provider-secret/);
  await provider.respondToApproval('qoder-new', requested.approval.id, 'accept');
  await flush();
  assert.deepEqual(permissionResult, {
    outcome: { outcome: 'selected', optionId: 'provider-secret-allow' },
  });
  completePrompt({ stopReason: 'end_turn' });
  await flush();

  runtimes[0]!.prompt = async () => {
    const permission = runtimes[0]!.handlers.onPermission(72, {
      sessionId: 'qoder-new',
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
    return new Promise(() => {});
  };
  await provider.sendMessage('qoder-new', 'Interrupt this');
  await flush();
  await provider.interrupt('qoder-new', turnId);
  await flush();
  assert.deepEqual(permissionResult, { outcome: { outcome: 'cancelled' } });
  assert.equal(runtimes[0]?.notifications[0]?.method, acp.methods.agent.session.cancel);
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
  runtimes[0]!.prompt = async () => new Promise(() => {});
  await provider.sendMessage('qoder-new', 'Keep running');
  runtimes[0]!.handlers.onExit('Qoder ACP exited (code=1, signal=null)');
  await flush();
  assert.ok(events.some(event => event.kind === 'turn.completed' && event.status === 'failed'));
  const descriptor = await provider.getDescriptor();
  assert.equal(descriptor.status, 'ready');
  assert.equal(runtimes.length, 1);
  await provider.startConversation();
  assert.equal(runtimes.length, 2);
  await provider.close();
  assert.equal(runtimes[1]?.closed, true);
});

test('bounds prompt timeouts and leaves the provider reusable', async () => {
  const { events, provider, runtimes } = harness(undefined, { requestTimeoutMs: 5 });
  await provider.startConversation();
  runtimes[0]!.prompt = async () => new Promise(() => {});
  await provider.sendMessage('qoder-new', 'Timeout safely');
  await new Promise<void>(resolve => setTimeout(resolve, 15));
  assert.ok(
    events.some(
      event =>
        event.kind === 'turn.completed' &&
        event.status === 'failed' &&
        event.error?.includes('timed out'),
    ),
  );
  runtimes[0]!.prompt = undefined;
  await provider.sendMessage('qoder-new', 'Try again');
  await flush();
  assert.ok(events.some(event => event.kind === 'turn.completed' && event.status === 'completed'));
  await provider.close();
});
