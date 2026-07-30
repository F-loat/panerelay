import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type {
  AgentProviderSummary,
  AgentRequest,
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationMessage,
  ConversationStatus,
  ConversationSummary,
} from '@panerelay/protocol';
import type { AgentProvider } from './agent-provider.js';
import { CodexAppServer, type CodexRpcMessage } from './codex-app-server.js';
import { readRuntimeConfig, type PanerelayRuntimeConfig } from './runtime-config.js';

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function timestamp(seconds: number | null | undefined): string {
  return new Date((seconds ?? Date.now() / 1_000) * 1_000).toISOString();
}

function threadStatus(thread: CodexThread): ConversationStatus {
  if (thread.status?.type === 'systemError') return 'error';
  if (thread.status?.type === 'active') {
    return thread.status.activeFlags?.includes('waitingOnApproval') ? 'waiting' : 'running';
  }
  return 'idle';
}

function threadSummary(thread: CodexThread): ConversationSummary {
  const preview = thread.preview?.trim() || '';
  return {
    id: thread.id,
    providerId: CODEX_PROVIDER_ID,
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
    case 'mcpToolCall':
      return {
        id: item.id,
        kind: item.server?.includes('panerelay') ? 'browser' : 'tool',
        title: [item.server, item.tool].filter(Boolean).join(' · ') || 'Use tool',
        status: normalizedStatus,
      };
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
  private config: PanerelayRuntimeConfig | null = null;
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly activeTurns = new Map<string, string>();
  private readonly listeners = new Set<(event: ConversationEvent) => void>();

  constructor(private readonly options: CodexProviderOptions) {}

  async handle(request: AgentRequest): Promise<unknown> {
    if (request.method === 'agent.providers') return [await this.getDescriptor()];
    if (request.providerId !== CODEX_PROVIDER_ID) {
      throw new Error(`Unknown agent provider: ${request.providerId}`);
    }

    switch (request.method) {
      case 'conversation.list':
        return this.listConversations();
      case 'conversation.start':
        return this.startConversation();
      case 'conversation.resume':
        return this.resumeConversation(request.conversationId);
      case 'conversation.send':
        return this.sendMessage(request.conversationId, request.text);
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
    await this.client?.close();
    this.client = null;
    this.config = null;
    this.pendingApprovals.clear();
    this.activeTurns.clear();
  }

  async getDescriptor(): Promise<AgentProviderSummary> {
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    return {
      id: CODEX_PROVIDER_ID,
      name: 'Codex',
      status: config.codexPath ? 'ready' : 'unavailable',
      description: 'Local Codex app-server with streamed turns, tools, and approvals.',
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

  private async ensureClient(): Promise<CodexClient> {
    if (this.client) return this.client;
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    if (!config.codexPath) {
      throw new Error('Codex CLI is unavailable. Install it and reinstall the Panerelay host.');
    }
    this.config = config;
    const handlers = {
      onNotification: (message: CodexRpcMessage) => this.handleNotification(message),
      onServerRequest: (message: CodexRpcMessage & { id: number | string; method: string }) =>
        this.handleServerRequest(message),
      onUnavailable: (message: string) => {
        this.client = null;
        this.emit({ kind: 'error', message });
      },
    };
    this.client = this.options.createClient
      ? this.options.createClient(config, handlers)
      : new CodexAppServer({
          codexPath: config.codexPath,
          pathEntries: config.agentBrowserPath ? [dirname(config.agentBrowserPath)] : [],
          ...handlers,
        });
    await this.client.start();
    return this.client;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const client = await this.ensureClient();
    const result = asRecord(
      await client.request('thread/list', {
        limit: 30,
        sortKey: 'updated_at',
        sortDirection: 'desc',
        sourceKinds: ['appServer'],
      }),
    );
    const data = Array.isArray(result.data) ? result.data : [];
    return data
      .map(thread => asRecord(thread) as unknown as CodexThread)
      .filter(thread => typeof thread.id === 'string')
      .map(threadSummary);
  }

  async startConversation(): Promise<ConversationDetail> {
    const client = await this.ensureClient();
    const config = this.config;
    const browserSession = `panerelay-codex-${randomUUID()}`;
    const browserMcpConfig =
      config?.agentBrowserPath && config.agentBrowserConfigPath
        ? {
            'mcp_servers.panerelay_browser.command': config.agentBrowserPath,
            'mcp_servers.panerelay_browser.args': ['mcp', '--tools', 'core,tabs'],
            'mcp_servers.panerelay_browser.env': {
              AGENT_BROWSER_CONFIG: config.agentBrowserConfigPath,
              AGENT_BROWSER_PROVIDER: 'panerelay',
              AGENT_BROWSER_SESSION: browserSession,
            },
            'mcp_servers.panerelay_browser.required': false,
            'mcp_servers.panerelay_browser.default_tools_approval_mode': 'auto',
          }
        : {};
    const result = asRecord(
      await client.request('thread/start', {
        cwd: homedir(),
        approvalPolicy: 'on-request',
        sandbox: 'read-only',
        serviceName: 'panerelay',
        developerInstructions:
          'You are running inside the Panerelay browser side panel. Use the panerelay_browser MCP tools for browser interaction when relevant. Browser authorization is controlled by the user in the side panel; never attempt to widen or bypass it. Keep chat responses concise and surface meaningful browser actions.',
        config: browserMcpConfig,
      }),
    );
    const thread = asRecord(result.thread) as unknown as CodexThread;
    if (typeof thread.id !== 'string') throw new Error('Codex did not return a conversation');
    return { conversation: threadSummary(thread), messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    const client = await this.ensureClient();
    await client.request('thread/resume', { threadId: conversationId });
    const result = asRecord(
      await client.request('thread/read', { threadId: conversationId, includeTurns: true }),
    );
    const thread = asRecord(result.thread) as unknown as CodexThread;
    if (typeof thread.id !== 'string') throw new Error('Codex conversation could not be read');
    const activeTurn = (thread.turns ?? []).find(turn => turn.status === 'inProgress');
    if (activeTurn) this.activeTurns.set(conversationId, activeTurn.id);
    return {
      conversation: threadSummary(thread),
      messages: historyMessages(thread),
    };
  }

  async sendMessage(conversationId: string, text: string): Promise<{ turnId: string }> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    const client = await this.ensureClient();
    const result = asRecord(
      await client.request('turn/start', {
        threadId: conversationId,
        input: [{ type: 'text', text: trimmed }],
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
