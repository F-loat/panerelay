import assert from 'node:assert/strict';
import test from 'node:test';
import * as acp from '@agentclientprotocol/sdk';
import type { ConversationEvent } from '@panerelay/protocol';
import {
  PANERELAY_CONTEXT_END,
  PANERELAY_CONTEXT_START,
  wrapAcpConversationContext,
} from '../acp/context.js';
import { QoderProvider, type QoderProviderOptions, type QoderRuntime } from './provider.js';

class FakeQoderRuntime implements QoderRuntime {
  readonly notifications: Array<{ method: string; params: unknown }> = [];
  readonly requests: Array<{ method: string; params: unknown }> = [];
  closed = false;
  historyAnswer: string | null = 'Earlier answer';
  historyChunks = ['Earlier question'];
  historyMessages: Array<{ id: string; role: 'assistant' | 'user'; text: string }> | undefined;
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
            cwd: '/listed-workspace',
            title: 'Existing Qoder session',
            updatedAt: '2026-07-30T00:00:00.000Z',
          },
        ],
      } satisfies acp.ListSessionsResponse;
    }
    if (method === acp.methods.agent.session.new) {
      return {
        sessionId: 'qoder-new',
        configOptions: [
          {
            id: 'model',
            name: 'Model',
            category: 'model',
            type: 'select',
            currentValue: 'qoder/model-new',
            options: [{ value: 'qoder/model-new', name: 'Qoder Model New' }],
          },
        ],
      } satisfies acp.NewSessionResponse;
    }
    if (method === acp.methods.agent.session.load) {
      const sessionId = (params as acp.LoadSessionRequest).sessionId;
      if (this.historyMessages) {
        for (const message of this.historyMessages) {
          this.handlers.onUpdate({
            sessionId,
            update: {
              sessionUpdate: message.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk',
              messageId: message.id,
              content: { type: 'text', text: message.text },
            },
          });
        }
      } else {
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
      }
      return {
        configOptions: [
          {
            id: 'model',
            name: 'Model',
            category: 'model',
            type: 'select',
            currentValue: 'qoder/model-existing',
            options: [{ value: 'qoder/model-existing', name: 'Qoder Model Existing' }],
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

test('passes the explicit Agent command environment to the Qoder ACP runtime', async () => {
  const environment = {
    HOME: '/Users/example',
    PATH: '/Users/example/.nvm/bin:/usr/bin:/bin',
  };
  let received: NodeJS.ProcessEnv | undefined;
  const { provider } = harness(undefined, {
    environment,
    createRuntime: (_executable, handlers, options) => {
      received = options.environment;
      return new FakeQoderRuntime(handlers);
    },
  });

  await provider.prepare();
  assert.equal(received, environment);
  await provider.close();
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
  assert.equal(started.conversation.model, 'Qoder Model New');
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
  const resumed = await provider.resumeConversation('qoder-existing');
  assert.equal(resumed.conversation.model, 'Qoder Model Existing');
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

test('restores retained Qoder messages when session load emits no history', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation({
    initialPage: { title: 'Private page orientation' },
  });
  const runtime = runtimes[0]!;
  runtime.prompt = async () => {
    runtime.handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'assistant-commentary',
        content: { type: 'text', text: 'First response' },
      },
    });
    runtime.handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'assistant-final',
        content: { type: 'text', text: 'Final response' },
      },
    });
    return { stopReason: 'end_turn' } satisfies acp.PromptResponse;
  };

  await provider.sendMessage('qoder-new', 'Inspect this page');
  await flush();
  runtime.historyChunks = [];
  runtime.historyAnswer = null;

  const resumed = await provider.resumeConversation('qoder-new');
  assert.deepEqual(
    resumed.messages.map(message => [message.role, message.text]),
    [
      ['user', 'Inspect this page'],
      ['assistant', 'First response'],
      ['assistant', 'Final response'],
    ],
  );
  assert.doesNotMatch(
    resumed.messages.map(message => message.text).join('\n'),
    /panerelay-context|Private page orientation/,
  );
});

test('prefers Qoder provider history and refreshes the bounded fallback transcript', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation();
  const runtime = runtimes[0]!;
  await provider.sendMessage('qoder-new', 'Live question');
  await flush();

  runtime.historyMessages = Array.from({ length: 1_002 }, (_, index) => ({
    id: `provider-${index + 1}`,
    role: 'user' as const,
    text: `Provider question ${index + 1}`,
  }));
  const providerHistory = await provider.resumeConversation('qoder-new');
  assert.equal(providerHistory.messages.length, 1_000);
  assert.equal(providerHistory.messages[0]?.text, 'Provider question 3');
  assert.equal(providerHistory.messages.at(-1)?.text, 'Provider question 1002');

  runtime.historyMessages = [];
  runtime.historyChunks = [];
  runtime.historyAnswer = null;
  const fallback = await provider.resumeConversation('qoder-new');
  assert.deepEqual(fallback.messages, providerHistory.messages);
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

test('keeps context before an image-only first prompt', async () => {
  const { provider, runtimes } = harness();
  await provider.startConversation();
  await provider.sendMessage('qoder-new', '', [
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
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'commentary-1',
        content: { type: 'text', text: 'I will inspect first.' },
      },
    });
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
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-command',
        title: 'git status --short',
        kind: 'execute',
        status: 'in_progress',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'M packages/bridge/src/providers/acp/provider.ts' },
          },
        ],
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-command',
        title: 'Qoder tool',
        kind: 'other',
        status: 'completed',
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-cleared',
        title: 'temporary output',
        kind: 'execute',
        status: 'in_progress',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'must be cleared' },
          },
        ],
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-cleared',
        status: 'completed',
        content: null,
      },
    });
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-output-bounded',
        title: 'bounded output',
        kind: 'execute',
        status: 'completed',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'o'.repeat(9_000) },
          },
          {
            type: 'content',
            content: {
              type: 'image',
              data: 'successful-image-must-not-cross',
              mimeType: 'image/png',
            },
          },
          { type: 'terminal', terminalId: 'terminal-must-not-cross' },
        ],
        rawInput: { secret: 'raw-input-must-not-cross' },
        rawOutput: { secret: 'raw-output-must-not-cross' },
        _meta: { secret: 'metadata-must-not-cross' },
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
        event.activity.id === 'tool-command' &&
        event.activity.kind === 'command' &&
        event.activity.title === 'git status --short' &&
        event.activity.output === 'M packages/bridge/src/providers/acp/provider.ts' &&
        event.activity.status === 'completed',
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.id === 'tool-cleared' &&
        event.activity.status === 'completed' &&
        event.activity.output === undefined,
    ),
  );
  assert.ok(
    events.some(
      event =>
        event.kind === 'activity.updated' &&
        event.activity.id === 'tool-output-bounded' &&
        event.activity.output?.length === 8 * 1024,
    ),
  );
  assert.ok(!JSON.stringify(events).includes('successful-image-must-not-cross'));
  assert.ok(!JSON.stringify(events).includes('terminal-must-not-cross'));
  assert.ok(!JSON.stringify(events).includes('raw-input-must-not-cross'));
  assert.ok(!JSON.stringify(events).includes('raw-output-must-not-cross'));
  assert.ok(!JSON.stringify(events).includes('metadata-must-not-cross'));
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
  assert.deepEqual(diagnostics, ['Ignored Qoder update: available_commands_update']);
});

test('keeps contiguous reasoning deltas together and starts a new segment after visible output', async () => {
  const { events, provider, runtimes } = harness();
  await provider.startConversation();
  runtimes[0]!.prompt = async () => {
    const handlers = runtimes[0]!.handlers;
    const thought = (text: string) =>
      handlers.onUpdate({
        sessionId: 'qoder-new',
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text },
        },
      });
    thought('first');
    thought(' contiguous');
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-between-thoughts',
        title: 'Inspect page',
        status: 'completed',
      },
    });
    thought('second');
    thought(' contiguous');
    handlers.onUpdate({
      sessionId: 'qoder-new',
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'message-between-thoughts',
        content: { type: 'text', text: 'Visible answer' },
      },
    });
    thought('third');
    return { stopReason: 'end_turn' };
  };

  await provider.sendMessage('qoder-new', 'Inspect');
  await flush();

  const reasoning = events.filter(
    (event): event is Extract<ConversationEvent, { kind: 'reasoning.delta' }> =>
      event.kind === 'reasoning.delta',
  );
  assert.equal(reasoning.length, 5);
  assert.equal(reasoning[0]?.itemId, reasoning[1]?.itemId);
  assert.equal(reasoning[2]?.itemId, reasoning[3]?.itemId);
  assert.notEqual(reasoning[0]?.itemId, reasoning[2]?.itemId);
  assert.notEqual(reasoning[2]?.itemId, reasoning[4]?.itemId);
  assert.deepEqual(
    events
      .filter(event =>
        ['reasoning.delta', 'activity.updated', 'message.delta'].includes(event.kind),
      )
      .map(event => event.kind),
    [
      'reasoning.delta',
      'reasoning.delta',
      'activity.updated',
      'reasoning.delta',
      'reasoning.delta',
      'message.delta',
      'reasoning.delta',
    ],
  );
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

  await provider.sendMessage('qoder-new', 'Use a tool');
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

  let cancelPrompt!: (value: acp.PromptResponse) => void;
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
    return new Promise(resolve => {
      cancelPrompt = resolve;
    });
  };
  const interrupted = await provider.sendMessage('qoder-new', 'Interrupt this');
  await flush();
  await provider.interrupt('qoder-new', interrupted.turnId);
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
  let failLatePrompt!: (error: Error) => void;
  runtimes[0]!.prompt = async () =>
    new Promise((_resolve, reject) => {
      failLatePrompt = reject;
    });
  const { turnId } = await provider.sendMessage('qoder-new', 'Keep running');
  runtimes[0]!.handlers.onExit('Qoder ACP exited (code=1, signal=null)');
  failLatePrompt(new Error('late prompt rejection'));
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
  const { turnId } = await provider.sendMessage('qoder-new', 'Keep working');
  await new Promise<void>(resolve => setTimeout(resolve, 15));
  assert.equal(
    events.some(event => event.kind === 'turn.completed' && event.turnId === turnId),
    false,
  );
  await assert.rejects(
    provider.sendMessage('qoder-new', 'Do not overlap'),
    /current Qoder turn has not finished/,
  );
  runtimes[0]!.handlers.onUpdate({
    sessionId: 'qoder-new',
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
  await provider.sendMessage('qoder-new', 'Try again');
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
  const { turnId } = await provider.sendMessage('qoder-new', 'Keep working');
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
        conversationId: 'qoder-new',
        turnId,
        status: 'interrupted',
      },
    ],
  );
});
