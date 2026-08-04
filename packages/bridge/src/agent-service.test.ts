import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  type AgentProviderSummary,
  type AgentRequest,
  type AgentRequestMessage,
  type ConversationApprovalDecision,
  type ConversationDetail,
  type ConversationEvent,
  type ConversationStartOptions,
  type ConversationSummary,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import type { AgentProvider } from './agent-provider.js';
import { AgentService } from './agent-service.js';

class FakeProvider implements AgentProvider {
  readonly calls: string[] = [];
  readonly listeners = new Set<(event: ConversationEvent) => void>();
  descriptorError?: Error;

  constructor(
    readonly id: string,
    private readonly conversationId: string,
  ) {}

  async close(): Promise<void> {
    this.calls.push('close');
  }

  async getDescriptor(): Promise<AgentProviderSummary> {
    this.calls.push('descriptor');
    if (this.descriptorError) throw this.descriptorError;
    return {
      id: this.id,
      name: this.id.toUpperCase(),
      status: 'ready',
      description: `${this.id} provider`,
    };
  }

  async prepare(): Promise<void> {
    this.calls.push('prepare');
  }

  async listConversations(cwd?: string): Promise<ConversationSummary[]> {
    this.calls.push(`list:${cwd ?? ''}`);
    return [this.summary()];
  }

  async startConversation(options?: ConversationStartOptions): Promise<ConversationDetail> {
    this.calls.push(`start:${JSON.stringify(options ?? {})}`);
    return { conversation: this.summary(), messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    this.calls.push(`resume:${conversationId}`);
    return { conversation: this.summary(conversationId), messages: [] };
  }

  async sendMessage(conversationId: string, text: string): Promise<{ turnId: string }> {
    this.calls.push(`send:${conversationId}:${text}`);
    return { turnId: `${this.id}-turn` };
  }

  async interrupt(conversationId: string, turnId: string): Promise<Record<string, never>> {
    this.calls.push(`interrupt:${conversationId}:${turnId}`);
    return {};
  }

  async respondToApproval(
    conversationId: string,
    approvalId: string,
    decision: ConversationApprovalDecision,
  ): Promise<Record<string, never>> {
    this.calls.push(`respond:${conversationId}:${approvalId}:${decision}`);
    return {};
  }

  onEvent(listener: (event: ConversationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ConversationEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private summary(id = this.conversationId): ConversationSummary {
    return {
      id,
      providerId: this.id,
      title: `${this.id} conversation`,
      preview: '',
      status: 'idle',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    };
  }
}

function request(requestId: string, value: AgentRequest): AgentRequestMessage {
  return {
    type: 'agent.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId,
    request: value,
  };
}

test('aggregates descriptors while containing an unavailable adapter failure', async () => {
  const messages: HostToExtensionMessage[] = [];
  const codex = new FakeProvider('codex', 'codex-1');
  const qoder = new FakeProvider('qoder', 'qoder-1');
  qoder.descriptorError = new Error('Qoder probe failed');
  const service = new AgentService(message => messages.push(message), {
    providers: [codex, qoder],
  });

  await service.handle(request('providers', { method: 'agent.providers' }));
  const response = messages[0];
  assert.equal(response?.type, 'agent.response');
  assert.deepEqual(response && 'result' in response ? response.result : undefined, [
    {
      id: 'codex',
      name: 'CODEX',
      status: 'ready',
      description: 'codex provider',
    },
    {
      id: 'qoder',
      name: 'qoder',
      status: 'error',
      description: 'The local provider could not be inspected.',
      setupHint: 'Qoder probe failed',
    },
  ]);
});

test('passes one explicit reconstructed environment to the default provider factory', async () => {
  const environment = { HOME: '/home/example', PATH: '/home/example/bin:/usr/bin' };
  const codex = new FakeProvider('codex', 'codex-1');
  let received: NodeJS.ProcessEnv | undefined;
  const service = new AgentService(() => {}, {
    environment,
    createProviders: value => {
      received = value;
      return [codex];
    },
  });

  assert.equal(received, environment);
  await service.close();
});

test('routes conversations to their provider and rejects mismatches before adapter access', async () => {
  const messages: HostToExtensionMessage[] = [];
  const codex = new FakeProvider('codex', 'codex-1');
  const qoder = new FakeProvider('qoder', 'qoder-1');
  const service = new AgentService(message => messages.push(message), {
    providers: [codex, qoder],
  });

  await service.handle(
    request('list-qoder', {
      method: 'conversation.list',
      providerId: 'qoder',
      cwd: '/workspace/project',
    }),
  );
  await service.handle(
    request('send-qoder', {
      method: 'conversation.send',
      providerId: 'qoder',
      conversationId: 'qoder-1',
      text: 'hello',
    }),
  );
  const qoderCalls = [...qoder.calls];
  await service.handle(
    request('wrong-provider', {
      method: 'conversation.send',
      providerId: 'codex',
      conversationId: 'qoder-1',
      text: 'must not route',
    }),
  );
  await service.handle(
    request('unknown-provider', {
      method: 'conversation.list',
      providerId: 'missing',
    }),
  );

  assert.deepEqual(qoderCalls, ['list:/workspace/project', 'send:qoder-1:hello']);
  assert.deepEqual(qoder.calls, qoderCalls);
  assert.deepEqual(codex.calls, []);
  const failures = messages.filter(
    (message): message is Extract<HostToExtensionMessage, { type: 'agent.response' }> =>
      message.type === 'agent.response' && !message.success,
  );
  assert.match(failures[0]?.error || '', /belongs to another agent provider/);
  assert.match(failures[1]?.error || '', /Unknown agent provider/);
});

test('prepares only the explicitly selected provider without creating a conversation', async () => {
  const messages: HostToExtensionMessage[] = [];
  const codex = new FakeProvider('codex', 'codex-1');
  const qoder = new FakeProvider('qoder', 'qoder-1');
  const service = new AgentService(message => messages.push(message), {
    providers: [codex, qoder],
  });

  await service.handle(request('prepare-qoder', { method: 'agent.prepare', providerId: 'qoder' }));

  assert.deepEqual(codex.calls, []);
  assert.deepEqual(qoder.calls, ['prepare']);
  assert.deepEqual(messages[0], {
    type: 'agent.response',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'prepare-qoder',
    success: true,
    result: {},
  });
});

test('routes project and initial page context only to conversation start', async () => {
  const messages: HostToExtensionMessage[] = [];
  const codex = new FakeProvider('codex', 'codex-1');
  const service = new AgentService(message => messages.push(message), {
    providers: [codex],
  });
  const options: ConversationStartOptions = {
    cwd: '/workspace/project',
    initialPage: { url: 'https://example.com/app', title: 'Example app' },
  };

  await service.handle(
    request('start-codex', {
      method: 'conversation.start',
      providerId: 'codex',
      options,
    }),
  );

  assert.deepEqual(codex.calls, [`start:${JSON.stringify(options)}`]);
  assert.equal(messages[0]?.type, 'agent.response');
});

test('correlates provider events and closes every adapter', async () => {
  const messages: HostToExtensionMessage[] = [];
  const codex = new FakeProvider('codex', 'codex-1');
  const qoder = new FakeProvider('qoder', 'qoder-1');
  const service = new AgentService(message => messages.push(message), {
    providers: [codex, qoder],
  });
  qoder.emit({
    kind: 'turn.started',
    conversationId: 'qoder-event-conversation',
    turnId: 'turn-1',
  });
  await service.handle(
    request('send-event-conversation', {
      method: 'conversation.send',
      providerId: 'qoder',
      conversationId: 'qoder-event-conversation',
      text: 'continue',
    }),
  );
  await service.close();

  assert.equal(messages[0]?.type, 'conversation.event');
  assert.deepEqual(codex.calls, ['close']);
  assert.deepEqual(qoder.calls, ['send:qoder-event-conversation:continue', 'close']);
  assert.equal(qoder.listeners.size, 0);
});
