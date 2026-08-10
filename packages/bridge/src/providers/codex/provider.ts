import { homedir } from 'node:os';
import type {
  AgentProviderSummary,
  AgentRequest,
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationImageInput,
  ConversationMessage,
  ConversationStartOptions,
  ConversationStatus,
  ConversationSummary,
} from '@panerelay/protocol';
import type { AgentProvider } from '../contract.js';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
} from '../../agent-context.js';
import { readBrowserAutomationSetupHint } from '../../browser-automation-hints.js';
import { readRuntimeConfig, type PanerelayRuntimeConfig } from '../../runtime-config.js';
import { CodexAppServer, type CodexRpcMessage } from './app-server.js';
import { codexFetchMcpConfigOverrides } from '../../provider-fetch-mcp.js';

interface CodexThread {
  id: string;
  preview?: string;
  name?: string | null;
  createdAt?: number;
  updatedAt?: number;
  status?: {
    type?: string;
    activeFlags?: string[];
  };
  turns?: CodexTurn[];
}

interface CodexTurn {
  id: string;
  status?: string;
  error?: { message?: string } | null;
  startedAt?: number | null;
  completedAt?: number | null;
  items?: CodexItem[];
}

interface CodexItem {
  type?: string;
  id?: string;
  text?: string;
  phase?: string | null;
  content?: Array<{ type?: string; text?: string }>;
  command?: string;
  cwd?: string;
  status?: string;
  changes?: unknown[];
  server?: string;
  tool?: string;
  query?: string;
  error?: { message?: string } | null;
}

interface PendingApproval {
  rpcId: number | string;
  method: string;
  conversationId: string;
  turnId: string;
}

export interface CodexClient {
  start(): Promise<void>;
  request(method: string, params?: unknown): Promise<unknown>;
  respond(id: number | string, result: unknown): void;
  close(): Promise<void>;
}

export interface CodexProviderOptions {
  environment?: NodeJS.ProcessEnv;
  onEvent?: (event: ConversationEvent) => void;
  runtimeConfig?: () => Promise<PanerelayRuntimeConfig>;
  createClient?: (
    config: PanerelayRuntimeConfig,
    handlers: {
      onNotification: (message: CodexRpcMessage) => void;
      onServerRequest: (message: CodexRpcMessage & { id: number | string; method: string }) => void;
      onUnavailable: (message: string) => void;
    },
  ) => CodexClient;
}

const CODEX_PROVIDER_ID = 'codex';
const MAX_ACTIVITY_DETAIL_CHARS = 8 * 1024;
const MAX_MODEL_CHARS = 256;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function timestamp(seconds: number | null | undefined): string {
  return new Date((seconds ?? Date.now() / 1_000) * 1_000).toISOString();
}

function activityErrorDetail(item: CodexItem, failed: boolean): string | undefined {
  if (!failed) return undefined;
  const message = item.error?.message?.trim();
  return message ? message.slice(0, MAX_ACTIVITY_DETAIL_CHARS) : undefined;
}

function threadStatus(thread: CodexThread): ConversationStatus {
  if (thread.status?.type === 'systemError') return 'error';
  if (thread.status?.type === 'active') {
    return thread.status.activeFlags?.includes('waitingOnApproval') ? 'waiting' : 'running';
  }
  return 'idle';
}

function modelName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const model = value.trim();
  return model ? model.slice(0, MAX_MODEL_CHARS) : undefined;
}

function defaultModelName(value: unknown): string | undefined {
  const data = asRecord(value).data;
  if (!Array.isArray(data)) return undefined;
  const defaultModel = data.map(asRecord).find(model => model.isDefault === true);
  return defaultModel ? (modelName(defaultModel.model) ?? modelName(defaultModel.id)) : undefined;
}

function threadSummary(thread: CodexThread, model?: string): ConversationSummary {
  const preview = thread.preview?.trim() || '';
  return {
    id: thread.id,
    providerId: CODEX_PROVIDER_ID,
    ...(model ? { model } : {}),
    title: thread.name?.trim() || preview.slice(0, 48) || 'New Codex conversation',
    preview,
    status: threadStatus(thread),
    createdAt: timestamp(thread.createdAt),
    updatedAt: timestamp(thread.updatedAt ?? thread.createdAt),
  };
}

function historyMessages(thread: CodexThread): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  for (const turn of thread.turns ?? []) {
    for (const item of turn.items ?? []) {
      if (!item.id) continue;
      if (item.type === 'userMessage') {
        const text = (item.content ?? [])
          .filter(content => content.type === 'text' && content.text)
          .map(content => content.text)
          .join('\n');
        if (text) {
          messages.push({
            id: item.id,
            role: 'user',
            text,
            createdAt: timestamp(turn.startedAt),
          });
        }
      }
      if (item.type === 'agentMessage' && item.text) {
        messages.push({
          id: item.id,
          role: 'assistant',
          text: item.text,
          ...(item.phase === 'commentary'
            ? { phase: 'commentary' as const }
            : item.phase === 'final_answer'
              ? { phase: 'final' as const }
              : {}),
          createdAt: timestamp(turn.completedAt ?? turn.startedAt),
        });
      }
    }
  }
  return messages;
}

function activityFromItem(item: CodexItem, completed: boolean): ConversationActivity | null {
  if (!item.id) return null;
  const normalizedStatus =
    item.status === 'failed'
      ? 'failed'
      : item.status === 'declined'
        ? 'declined'
        : completed
          ? 'completed'
          : 'running';

  switch (item.type) {
    case 'commandExecution':
      return {
        id: item.id,
        kind: 'command',
        title: item.command || 'Run command',
        ...(item.cwd ? { detail: item.cwd } : {}),
        status: normalizedStatus,
      };
    case 'fileChange':
      return {
        id: item.id,
        kind: 'file-change',
        title: completed ? 'Updated files' : 'Updating files',
        ...(item.changes ? { detail: `${item.changes.length} file change(s)` } : {}),
        status: normalizedStatus,
      };
    case 'mcpToolCall': {
      const detail = activityErrorDetail(item, normalizedStatus === 'failed');
      return {
        id: item.id,
        kind: item.server?.includes('panerelay') ? 'browser' : 'tool',
        title: [item.server, item.tool].filter(Boolean).join(' · ') || 'Use tool',
        ...(detail ? { detail } : {}),
        status: normalizedStatus,
      };
    }
    case 'webSearch':
      return {
        id: item.id,
        kind: 'web-search',
        title: item.query ? `Search: ${item.query}` : 'Search the web',
        status: normalizedStatus,
      };
    default:
      return null;
  }
}

export class CodexProvider implements AgentProvider {
  readonly id = CODEX_PROVIDER_ID;
  private client: CodexClient | null = null;
  private clientStart: Promise<CodexClient> | null = null;
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly activeTurns = new Map<string, string>();
  private readonly listeners = new Set<(event: ConversationEvent) => void>();
  private defaultModel: string | undefined;
  private modelMetadataPrepared = false;
  private modelMetadataPreparation: Promise<void> | null = null;
  private modelMetadataGeneration = 0;

  constructor(private readonly options: CodexProviderOptions) {}

  async handle(request: AgentRequest): Promise<unknown> {
    if (request.method === 'agent.providers') return [await this.getDescriptor()];
    if (request.providerId !== CODEX_PROVIDER_ID) {
      throw new Error(`Unknown agent provider: ${request.providerId}`);
    }

    switch (request.method) {
      case 'agent.prepare':
        await this.prepare();
        return {};
      case 'conversation.list':
        return this.listConversations();
      case 'conversation.start':
        return this.startConversation(request.options);
      case 'conversation.resume':
        return this.resumeConversation(request.conversationId);
      case 'conversation.send':
        return this.sendMessage(request.conversationId, request.text, request.images);
      case 'conversation.interrupt':
        return this.interrupt(request.conversationId, request.turnId);
      case 'conversation.respond':
        return this.respondToApproval(request.conversationId, request.approvalId, request.decision);
    }
  }

  onEvent(listener: (event: ConversationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    const client = this.client ?? (await this.clientStart?.catch(() => null));
    this.client = null;
    this.clientStart = null;
    this.pendingApprovals.clear();
    this.activeTurns.clear();
    this.resetModelMetadata();
    await client?.close();
  }

  private resetModelMetadata(): void {
    this.modelMetadataGeneration += 1;
    this.defaultModel = undefined;
    this.modelMetadataPrepared = false;
    this.modelMetadataPreparation = null;
  }

  async getDescriptor(): Promise<AgentProviderSummary> {
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    return {
      id: CODEX_PROVIDER_ID,
      name: 'Codex',
      status: config.codexPath ? 'ready' : 'unavailable',
      description: 'Local Codex app-server with streamed turns, tools, and approvals.',
      ...(this.defaultModel ? { model: this.defaultModel } : {}),
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
      ...(!config.codexPath
        ? { setupHint: 'Install Codex CLI, then run npx --yes @panerelay/setup again.' }
        : {}),
    };
  }

  async prepare(): Promise<void> {
    const client = await this.ensureClient();
    if (this.modelMetadataPrepared) return;
    if (!this.modelMetadataPreparation) {
      const generation = this.modelMetadataGeneration;
      this.modelMetadataPreparation = (async () => {
        let model: string | undefined;
        try {
          try {
            const result = asRecord(await client.request('config/read', { includeLayers: false }));
            model = modelName(asRecord(result.config).model);
          } catch {
            // Continue with the resolved catalog default when configuration cannot be read.
          }
          if (!model) {
            try {
              model = defaultModelName(
                await client.request('model/list', {
                  cursor: null,
                  limit: 100,
                  includeHidden: false,
                }),
              );
            } catch {
              // Model metadata is optional and must not make an otherwise ready provider unavailable.
            }
          }
        } finally {
          if (generation === this.modelMetadataGeneration && this.client === client) {
            this.defaultModel = model ?? this.defaultModel;
            this.modelMetadataPrepared = true;
            this.modelMetadataPreparation = null;
          }
        }
      })();
    }
    await this.modelMetadataPreparation;
  }

  private async ensureClient(): Promise<CodexClient> {
    if (this.client) return this.client;
    if (this.clientStart) return this.clientStart;
    this.clientStart = this.startClient();
    try {
      return await this.clientStart;
    } finally {
      this.clientStart = null;
    }
  }

  private async startClient(): Promise<CodexClient> {
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    if (!config.codexPath) {
      throw new Error('Codex CLI is unavailable. Install it and reinstall the Panerelay host.');
    }
    let client: CodexClient | null = null;
    const handlers = {
      onNotification: (message: CodexRpcMessage) => this.handleNotification(message),
      onServerRequest: (message: CodexRpcMessage & { id: number | string; method: string }) =>
        this.handleServerRequest(message),
      onUnavailable: (message: string) => {
        if (!client || this.client !== client) return;
        this.client = null;
        this.resetModelMetadata();
        this.emit({ kind: 'error', message });
      },
    };
    client = this.options.createClient
      ? this.options.createClient(config, handlers)
      : new CodexAppServer({
          codexPath: config.codexPath,
          configOverrides: codexFetchMcpConfigOverrides(),
          environment: this.options.environment,
          ...handlers,
        });
    try {
      await client.start();
      this.client = client;
      return client;
    } catch (error) {
      if (this.client === client) this.client = null;
      await client.close().catch(() => {});
      throw error;
    }
  }

  async listConversations(cwd?: string): Promise<ConversationSummary[]> {
    const client = await this.ensureClient();
    const result = asRecord(
      await client.request('thread/list', {
        cursor: null,
        limit: 30,
        sortKey: 'updated_at',
        sortDirection: 'desc',
        archived: false,
        ...(cwd ? { cwd } : {}),
      }),
    );
    const data = Array.isArray(result.data) ? result.data : [];
    return data
      .map(thread => asRecord(thread) as unknown as CodexThread)
      .filter(thread => typeof thread.id === 'string')
      .map(thread => threadSummary(thread));
  }

  async startConversation(options: ConversationStartOptions = {}): Promise<ConversationDetail> {
    const client = await this.ensureClient();
    const resolvedOptions = resolveConversationStartOptions(options);
    const contextInstructions = createConversationContextInstructions(
      resolvedOptions,
      await readBrowserAutomationSetupHint(),
    );
    const result = asRecord(
      await client.request('thread/start', {
        cwd: resolvedOptions.cwd ?? homedir(),
        approvalPolicy: 'on-request',
        sandbox: 'read-only',
        serviceName: 'panerelay',
        ...(contextInstructions ? { developerInstructions: contextInstructions } : {}),
      }),
    );
    const thread = asRecord(result.thread) as unknown as CodexThread;
    if (typeof thread.id !== 'string') throw new Error('Codex did not return a conversation');
    const model = modelName(result.model);
    if (model) this.defaultModel = model;
    return { conversation: threadSummary(thread, model), messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    const client = await this.ensureClient();
    const resumed = asRecord(await client.request('thread/resume', { threadId: conversationId }));
    const model = modelName(resumed.model);
    if (model) this.defaultModel = model;
    const result = asRecord(
      await client.request('thread/read', { threadId: conversationId, includeTurns: true }),
    );
    const thread = asRecord(result.thread) as unknown as CodexThread;
    if (typeof thread.id !== 'string') throw new Error('Codex conversation could not be read');
    const activeTurn = (thread.turns ?? []).find(turn => turn.status === 'inProgress');
    if (activeTurn) this.activeTurns.set(conversationId, activeTurn.id);
    return {
      conversation: threadSummary(thread, model),
      messages: historyMessages(thread),
    };
  }

  async sendMessage(
    conversationId: string,
    text: string,
    images: ConversationImageInput[] = [],
  ): Promise<{ turnId: string }> {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) throw new Error('Message cannot be empty');
    const client = await this.ensureClient();
    const result = asRecord(
      await client.request('turn/start', {
        threadId: conversationId,
        input: [
          ...(trimmed ? [{ type: 'text', text: trimmed }] : []),
          ...images.map(image => ({
            type: 'image',
            url: `data:${image.mimeType};base64,${image.data}`,
          })),
        ],
      }),
    );
    const turn = asRecord(result.turn);
    if (typeof turn.id !== 'string') throw new Error('Codex did not start a turn');
    this.activeTurns.set(conversationId, turn.id);
    return { turnId: turn.id };
  }

  async interrupt(conversationId: string, turnId: string): Promise<Record<string, never>> {
    const client = await this.ensureClient();
    await client.request('turn/interrupt', { threadId: conversationId, turnId });
    return {};
  }

  async respondToApproval(
    conversationId: string,
    approvalId: string,
    decision: ConversationApprovalDecision,
  ): Promise<Record<string, never>> {
    if (decision === 'declineForSession') {
      throw new Error('Codex does not support declining an approval for the session');
    }
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending || pending.conversationId !== conversationId) {
      throw new Error('This approval is no longer pending');
    }
    const client = await this.ensureClient();
    client.respond(pending.rpcId, { decision });
    this.pendingApprovals.delete(approvalId);
    this.emit({
      kind: 'approval.resolved',
      conversationId,
      turnId: pending.turnId,
      approvalId,
    });
    return {};
  }

  private handleNotification(message: CodexRpcMessage): void {
    const params = asRecord(message.params);
    const conversationId = typeof params.threadId === 'string' ? params.threadId : undefined;
    const turn = asRecord(params.turn);
    const turnId =
      typeof params.turnId === 'string'
        ? params.turnId
        : typeof turn.id === 'string'
          ? turn.id
          : undefined;

    if (message.method === 'turn/started' && conversationId && turnId) {
      this.activeTurns.set(conversationId, turnId);
      this.emit({ kind: 'turn.started', conversationId, turnId });
      return;
    }
    if (
      message.method === 'item/agentMessage/delta' &&
      conversationId &&
      turnId &&
      typeof params.itemId === 'string' &&
      typeof params.delta === 'string'
    ) {
      this.emit({
        kind: 'message.delta',
        conversationId,
        turnId,
        messageId: params.itemId,
        delta: params.delta,
      });
      return;
    }
    if (
      message.method === 'item/reasoning/summaryTextDelta' &&
      conversationId &&
      turnId &&
      typeof params.itemId === 'string' &&
      typeof params.delta === 'string'
    ) {
      this.emit({
        kind: 'reasoning.delta',
        conversationId,
        turnId,
        itemId: params.itemId,
        delta: params.delta,
      });
      return;
    }
    if (
      (message.method === 'item/started' || message.method === 'item/completed') &&
      conversationId &&
      turnId
    ) {
      const item = asRecord(params.item) as unknown as CodexItem;
      if (message.method === 'item/completed' && item.type === 'agentMessage' && item.id) {
        this.emit({
          kind: 'message.completed',
          conversationId,
          turnId,
          message: {
            id: item.id,
            role: 'assistant',
            text: item.text || '',
            ...(item.phase === 'commentary'
              ? { phase: 'commentary' as const }
              : item.phase === 'final_answer'
                ? { phase: 'final' as const }
                : {}),
            createdAt: new Date().toISOString(),
          },
        });
        return;
      }
      const activity = activityFromItem(item, message.method === 'item/completed');
      if (activity) {
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId,
          activity,
        });
      }
      return;
    }
    if (message.method === 'turn/completed' && conversationId && turnId) {
      this.activeTurns.delete(conversationId);
      const status =
        turn.status === 'interrupted'
          ? 'interrupted'
          : turn.status === 'failed'
            ? 'failed'
            : 'completed';
      const error = asRecord(turn.error);
      this.emit({
        kind: 'turn.completed',
        conversationId,
        turnId,
        status,
        ...(typeof error.message === 'string' ? { error: error.message } : {}),
      });
      return;
    }
    if (message.method === 'error') {
      const error = asRecord(params.error);
      this.emit({
        kind: 'error',
        ...(conversationId ? { conversationId } : {}),
        message:
          typeof error.message === 'string' ? error.message : 'Codex reported an unknown error',
      });
    }
  }

  private handleServerRequest(
    message: CodexRpcMessage & { id: number | string; method: string },
  ): void {
    if (
      message.method !== 'item/commandExecution/requestApproval' &&
      message.method !== 'item/fileChange/requestApproval'
    ) {
      this.client?.respond(message.id, {});
      return;
    }

    const params = asRecord(message.params);
    if (
      typeof params.threadId !== 'string' ||
      typeof params.turnId !== 'string' ||
      typeof params.itemId !== 'string'
    ) {
      this.client?.respond(message.id, { decision: 'cancel' });
      return;
    }

    const approvalId = `codex:${String(message.id)}`;
    const isCommand = message.method === 'item/commandExecution/requestApproval';
    const approval: ConversationApproval = {
      id: approvalId,
      conversationId: params.threadId,
      turnId: params.turnId,
      kind: isCommand ? 'command' : 'file-change',
      title: isCommand ? 'Allow Codex to run this command?' : 'Allow Codex to update files?',
      ...(typeof params.reason === 'string' ? { description: params.reason } : {}),
      ...(typeof params.command === 'string' ? { command: params.command } : {}),
      ...(typeof params.cwd === 'string' ? { cwd: params.cwd } : {}),
      decisions: ['accept', 'acceptForSession', 'decline'],
    };
    this.pendingApprovals.set(approvalId, {
      rpcId: message.id,
      method: message.method,
      conversationId: params.threadId,
      turnId: params.turnId,
    });
    this.emit({
      kind: 'approval.requested',
      conversationId: params.threadId,
      turnId: params.turnId,
      approval,
    });
  }

  private emit(event: ConversationEvent): void {
    this.options.onEvent?.(event);
    for (const listener of this.listeners) listener(event);
  }
}
