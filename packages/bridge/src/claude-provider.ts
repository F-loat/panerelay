import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import type {
  AgentProviderSummary,
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationImageInput,
  ConversationMessage,
  ConversationStartOptions,
  ConversationSummary,
} from '@panerelay/protocol';
import { PANERELAY_BROWSER_ID_ENV } from '@panerelay/browser-registry';
import type { AgentProvider } from './agent-provider.js';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
} from './agent-context.js';
import {
  createClaudeCli,
  type ClaudeCli,
  type ClaudeCliMessage,
  type ClaudeCliQuery,
  type ClaudeCliUserMessage,
  type ClaudeMcpServer,
  type ClaudeSessionInfo,
  type ClaudeSessionMessage,
} from './claude-cli.js';
import {
  createClaudePermissionServer,
  type ClaudePermissionHandler,
  type ClaudePermissionServer,
  type ClaudePermissionToolRequest,
  type ClaudePermissionToolResult,
} from './claude-permission-server.js';
import { isClaudeCodeSupported } from './compatibility.js';
import { resolveSpawnCommand, runCommand, type CommandRunner } from './platform.js';
import { readRuntimeConfig, type PanerelayRuntimeConfig } from './runtime-config.js';

const CLAUDE_PROVIDER_ID = 'claude';
const MAX_TEXT_CHARS = 64 * 1024;
const MAX_DETAIL_CHARS = 8 * 1024;
const BROWSER_CLEANUP_TIMEOUT_MS = 5_000;

interface ClaudeBrowserSession {
  configPath: string;
  executable: string;
  label: string;
}

interface ClaudeSession {
  activeTurn?: ClaudeTurn;
  cwd: string;
  id: string;
  initialContext?: string;
  persisted: boolean;
}

interface ClaudeTurn {
  activities: Map<string, ConversationActivity>;
  assistantMessageId: string;
  browserSession?: ClaudeBrowserSession;
  id: string;
  interrupted: boolean;
  permissionServer?: ClaudePermissionServer;
  query: ClaudeCliQuery;
  seenToolUseIds: Set<string>;
}

interface ClaudePermission {
  conversationId: string;
  input: Record<string, unknown>;
  removeAbortListener: () => void;
  resolve: (result: ClaudePermissionToolResult) => void;
  turnId: string;
}

export interface ClaudeProviderOptions {
  closeBrowserSession?: (session: ClaudeBrowserSession) => Promise<void>;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  runtimeConfig?: () => Promise<PanerelayRuntimeConfig>;
  cli?: ClaudeCli;
  createPermissionServer?: (handler: ClaudePermissionHandler) => Promise<ClaudePermissionServer>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bounded(value: string, maximum = MAX_TEXT_CHARS): string {
  return value.slice(0, maximum);
}

function timestamp(value: unknown): string {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
}

function sessionSummary(session: ClaudeSessionInfo): ConversationSummary {
  const preview = session.firstPrompt?.trim() || '';
  return {
    id: session.sessionId,
    providerId: CLAUDE_PROVIDER_ID,
    title: bounded(
      session.customTitle?.trim() ||
        session.summary?.trim() ||
        preview.slice(0, 48) ||
        'Claude conversation',
      128,
    ),
    preview: bounded(preview),
    status: 'idle',
    createdAt: timestamp(session.createdAt ?? session.lastModified),
    updatedAt: timestamp(session.lastModified),
  };
}

function pendingSessionSummary(session: ClaudeSession): ConversationSummary {
  const now = new Date().toISOString();
  return {
    id: session.id,
    providerId: CLAUDE_PROVIDER_ID,
    title: 'New Claude conversation',
    preview: '',
    status: 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

function contentBlocks(message: unknown): unknown[] {
  const content = asRecord(message).content;
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return Array.isArray(content) ? content : [];
}

function textFromBlocks(blocks: unknown[]): string {
  return bounded(
    blocks
      .map(block => asRecord(block))
      .filter(block => block.type === 'text' && typeof block.text === 'string')
      .map(block => block.text as string)
      .join('\n'),
  );
}

function historyMessages(messages: ClaudeSessionMessage[]): ConversationMessage[] {
  const normalized: ConversationMessage[] = [];
  for (const item of messages) {
    if (item.parent_tool_use_id) continue;
    if (item.type !== 'user' && item.type !== 'assistant') continue;
    const message = asRecord(item.message);
    const text = textFromBlocks(contentBlocks(message));
    if (!text) continue;
    normalized.push({
      id: item.uuid,
      role: item.type,
      text,
      createdAt: timestamp(asRecord(item).timestamp),
    });
  }
  return normalized;
}

function activityKind(toolName: string): ConversationActivity['kind'] {
  const normalized = toolName.toLowerCase();
  if (normalized === 'bash' || normalized.includes('shell')) return 'command';
  if (['edit', 'write', 'notebookedit'].includes(normalized)) return 'file-change';
  if (normalized.includes('panerelay') || normalized.includes('browser')) return 'browser';
  if (normalized === 'websearch' || normalized === 'webfetch') return 'web-search';
  return 'tool';
}

function toolTitle(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'Bash' && typeof input.command === 'string') {
    return bounded(input.command, 256);
  }
  const path =
    typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.path === 'string'
        ? input.path
        : undefined;
  return path ? `${toolName}: ${bounded(path, 220)}` : toolName;
}

function approvalFromTool(
  conversationId: string,
  turnId: string,
  toolName: string,
  input: Record<string, unknown>,
  options: {
    blockedPath?: string;
    decisionReason?: string;
    description?: string;
    displayName?: string;
    title?: string;
    toolUseID: string;
  },
): ConversationApproval {
  const kind = activityKind(toolName);
  const description = [options.description, options.decisionReason, options.blockedPath]
    .filter((value): value is string => Boolean(value))
    .join('\n');
  return {
    id: options.toolUseID,
    conversationId,
    turnId,
    kind: kind === 'command' || kind === 'file-change' ? kind : 'tool',
    title: bounded(options.title || options.displayName || toolTitle(toolName, input), 256),
    ...(description ? { description: bounded(description, MAX_DETAIL_CHARS) } : {}),
    ...(toolName === 'Bash' && typeof input.command === 'string'
      ? { command: bounded(input.command, MAX_DETAIL_CHARS) }
      : {}),
    ...(typeof input.cwd === 'string' ? { cwd: bounded(input.cwd, 1024) } : {}),
    decisions: ['accept', 'decline', 'cancel'],
  };
}

export function claudeBrowserMcpServers(
  config: PanerelayRuntimeConfig,
  sessionLabel: string,
  browserId = process.env[PANERELAY_BROWSER_ID_ENV],
): Record<string, ClaudeMcpServer> {
  if (!config.agentBrowserPath || !config.agentBrowserConfigPath) return {};
  return {
    panerelay_browser: {
      type: 'stdio',
      command: config.agentBrowserPath,
      args: ['mcp', '--tools', 'core,tabs'],
      env: {
        AGENT_BROWSER_CONFIG: config.agentBrowserConfigPath,
        AGENT_BROWSER_PROVIDER: 'panerelay',
        AGENT_BROWSER_SESSION: sessionLabel,
        ...(browserId ? { [PANERELAY_BROWSER_ID_ENV]: browserId } : {}),
      },
    },
  };
}

async function closeClaudeBrowserSession(
  session: ClaudeBrowserSession,
  options: {
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    runner?: CommandRunner;
  },
): Promise<void> {
  const environment: NodeJS.ProcessEnv = {
    ...(options.environment ?? process.env),
    AGENT_BROWSER_CONFIG: session.configPath,
    AGENT_BROWSER_PROVIDER: 'panerelay',
    AGENT_BROWSER_SESSION: session.label,
  };
  const launch = resolveSpawnCommand(
    session.executable,
    ['--session', session.label, '--provider', 'panerelay', 'close'],
    options.platform,
    environment.ComSpec,
  );
  const result = await (options.runner ?? runCommand)(launch.command, launch.args, {
    environment,
    timeoutMs: BROWSER_CLEANUP_TIMEOUT_MS,
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (result.code !== 0) {
    throw new Error(`agent-browser cleanup exited with code ${result.code}`);
  }
}

function promptInput(text: string, images: ConversationImageInput[]): ClaudeCliUserMessage {
  return {
    type: 'user',
    session_id: '',
    message: {
      role: 'user',
      content: [
        ...(text ? [{ type: 'text' as const, text }] : []),
        ...images.map(image => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: image.data,
          },
        })),
      ],
    },
    parent_tool_use_id: null,
  };
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export class ClaudeProvider implements AgentProvider {
  readonly id = CLAUDE_PROVIDER_ID;
  private readonly listeners = new Set<(event: ConversationEvent) => void>();
  private readonly pendingPermissions = new Map<string, ClaudePermission>();
  private readonly cli: ClaudeCli;
  private readonly sessions = new Map<string, ClaudeSession>();
  private config: PanerelayRuntimeConfig | null = null;

  constructor(private readonly options: ClaudeProviderOptions = {}) {
    this.cli =
      options.cli ??
      createClaudeCli({
        environment: options.environment,
        platform: options.platform,
      });
  }

  onEvent(listener: (event: ConversationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ConversationEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private async runtimeConfig(): Promise<PanerelayRuntimeConfig> {
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    this.config = config;
    return config;
  }

  async getDescriptor(): Promise<AgentProviderSummary> {
    const config = await this.runtimeConfig();
    const ready = Boolean(config.claudePath && isClaudeCodeSupported(config.claudeVersion));
    return {
      id: CLAUDE_PROVIDER_ID,
      name: 'Claude Code',
      status: ready ? 'ready' : 'unavailable',
      description: 'Local Claude Code through the installed Claude Code CLI.',
      ...(config.claudeVersion ? { version: config.claudeVersion } : {}),
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
      ...(!ready
        ? {
            setupHint: config.claudePath
              ? 'Upgrade Claude Code, then run npx --yes @panerelay/setup again.'
              : 'Install Claude Code, then run npx --yes @panerelay/setup again.',
          }
        : {}),
    };
  }

  async prepare(): Promise<void> {
    const config = await this.runtimeConfig();
    if (!config.claudePath) {
      throw new Error('Claude Code is unavailable. Install it and reinstall the Panerelay host.');
    }
    if (!isClaudeCodeSupported(config.claudeVersion)) {
      throw new Error('Claude Code is incompatible. Upgrade it and reinstall the Panerelay host.');
    }
  }

  async listConversations(cwd?: string): Promise<ConversationSummary[]> {
    await this.prepare();
    const sessions = await this.cli.listSessions({
      ...(cwd ? { dir: cwd } : {}),
      limit: 30,
    });
    return sessions.map(sessionSummary);
  }

  async startConversation(options: ConversationStartOptions = {}): Promise<ConversationDetail> {
    await this.prepare();
    const resolved = resolveConversationStartOptions(options);
    const session: ClaudeSession = {
      id: randomUUID(),
      cwd: resolved.cwd ?? homedir(),
      initialContext: createConversationContextInstructions(resolved),
      persisted: false,
    };
    this.sessions.set(session.id, session);
    return { conversation: pendingSessionSummary(session), messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    await this.prepare();
    const info = await this.cli.getSessionInfo(conversationId);
    if (!info) throw new Error('Claude conversation could not be read');
    const messages = await this.cli.getSessionMessages(conversationId, {
      ...(info.cwd ? { dir: info.cwd } : {}),
      limit: 1_000,
    });
    this.sessions.set(conversationId, {
      id: conversationId,
      cwd: info.cwd ?? homedir(),
      persisted: true,
    });
    return {
      conversation: sessionSummary(info),
      messages: historyMessages(messages),
    };
  }

  async sendMessage(
    conversationId: string,
    text: string,
    images: ConversationImageInput[] = [],
  ): Promise<{ turnId: string }> {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) throw new Error('Message cannot be empty');
    const session = this.sessions.get(conversationId);
    if (!session) throw new Error(`Unknown Claude conversation: ${conversationId}`);
    if (session.activeTurn) throw new Error('Claude conversation already has an active turn');
    const config = this.config ?? (await this.runtimeConfig());
    if (!config.claudePath) throw new Error('Claude Code is unavailable');

    const turnId = randomUUID();
    const browserLabel = `panerelay-claude-${randomUUID()}`;
    const browserSession =
      config.agentBrowserPath && config.agentBrowserConfigPath
        ? {
            configPath: config.agentBrowserConfigPath,
            executable: config.agentBrowserPath,
            label: browserLabel,
          }
        : undefined;
    const systemInstructions = [
      'You are running inside the Panerelay browser side panel. Use the panerelay_browser MCP tools for browser interaction when relevant. Browser authorization is controlled by the user in the side panel; never attempt to widen or bypass it. Keep chat responses concise and surface meaningful browser actions.',
      session.persisted ? '' : session.initialContext,
    ]
      .filter(Boolean)
      .join('\n\n');
    const turnState: { current?: ClaudeTurn } = {};
    const permissionServer = await (
      this.options.createPermissionServer ?? createClaudePermissionServer
    )(async (request, signal) => {
      if (!turnState.current) return { behavior: 'deny', message: 'Claude turn is not ready' };
      return this.requestPermission(session, turnState.current, request, signal);
    });
    let query: ClaudeCliQuery;
    try {
      query = this.cli.query({
        executable: config.claudePath,
        cwd: session.cwd,
        prompt: promptInput(trimmed, images),
        mcpServers: {
          ...claudeBrowserMcpServers(
            config,
            browserLabel,
            (this.options.environment ?? process.env)[PANERELAY_BROWSER_ID_ENV],
          ),
          panerelay_permission: permissionServer.mcpServer,
        },
        permissionPromptTool: permissionServer.toolName,
        systemPrompt: systemInstructions,
        ...(session.persisted ? { resume: conversationId } : { sessionId: conversationId }),
      });
    } catch (error) {
      await permissionServer.close().catch(() => {});
      throw error;
    }
    const turn: ClaudeTurn = {
      activities: new Map(),
      assistantMessageId: `message-${turnId}`,
      ...(browserSession ? { browserSession } : {}),
      id: turnId,
      interrupted: false,
      permissionServer,
      query,
      seenToolUseIds: new Set(),
    };
    turnState.current = turn;
    session.activeTurn = turn;
    this.emit({ kind: 'turn.started', conversationId, turnId });
    void this.consume(session, turn);
    return { turnId };
  }

  private requestPermission(
    session: ClaudeSession,
    turn: ClaudeTurn,
    request: ClaudePermissionToolRequest,
    signal: AbortSignal,
  ): Promise<ClaudePermissionToolResult> {
    if (turn.interrupted || signal.aborted) {
      return Promise.resolve({ behavior: 'deny', message: 'Claude turn is no longer active' });
    }
    const approvalId = request.toolUseId ?? randomUUID();
    if (
      this.pendingPermissions.has(approvalId) ||
      (request.toolUseId !== undefined && turn.seenToolUseIds.has(request.toolUseId))
    ) {
      return Promise.resolve({ behavior: 'deny', message: 'Duplicate permission request' });
    }
    if (request.toolUseId) turn.seenToolUseIds.add(request.toolUseId);

    return new Promise(resolve => {
      const abort = (): void => {
        const pending = this.pendingPermissions.get(approvalId);
        if (!pending || pending.resolve !== resolve) return;
        this.resolvePermission(approvalId, pending, {
          behavior: 'deny',
          message: 'Permission request cancelled',
          interrupt: true,
        });
      };
      signal.addEventListener('abort', abort, { once: true });
      this.pendingPermissions.set(approvalId, {
        conversationId: session.id,
        input: request.input,
        removeAbortListener: () => signal.removeEventListener('abort', abort),
        resolve,
        turnId: turn.id,
      });
      this.emit({
        kind: 'approval.requested',
        conversationId: session.id,
        turnId: turn.id,
        approval: approvalFromTool(session.id, turn.id, request.toolName, request.input, {
          toolUseID: approvalId,
        }),
      });
      if (signal.aborted) abort();
    });
  }

  private resolvePermission(
    approvalId: string,
    pending: ClaudePermission,
    result: ClaudePermissionToolResult,
  ): void {
    if (this.pendingPermissions.get(approvalId) !== pending) return;
    this.pendingPermissions.delete(approvalId);
    pending.removeAbortListener();
    this.emit({
      kind: 'approval.resolved',
      conversationId: pending.conversationId,
      turnId: pending.turnId,
      approvalId,
    });
    pending.resolve(result);
  }

  async respondToApproval(
    conversationId: string,
    approvalId: string,
    decision: ConversationApprovalDecision,
  ): Promise<Record<string, never>> {
    const pending = this.pendingPermissions.get(approvalId);
    if (!pending || pending.conversationId !== conversationId) {
      throw new Error('This approval is no longer pending');
    }
    if (decision === 'acceptForSession' || decision === 'declineForSession') {
      throw new Error('Claude Code provider only supports one-request approval decisions');
    }
    this.resolvePermission(
      approvalId,
      pending,
      decision === 'accept'
        ? { behavior: 'allow', updatedInput: pending.input }
        : {
            behavior: 'deny',
            message: decision === 'cancel' ? 'Cancelled by user' : 'Declined by user',
            interrupt: decision === 'cancel',
          },
    );
    return {};
  }

  async interrupt(conversationId: string, turnId: string): Promise<Record<string, never>> {
    const turn = this.sessions.get(conversationId)?.activeTurn;
    if (!turn || turn.id !== turnId) throw new Error('This Claude turn is no longer active');
    turn.interrupted = true;
    await this.denyPermissions(conversationId, turnId, 'Turn interrupted');
    await turn.query.interrupt();
    return {};
  }

  private async denyPermissions(
    conversationId: string,
    turnId: string,
    message: string,
  ): Promise<void> {
    for (const [approvalId, pending] of this.pendingPermissions) {
      if (pending.conversationId !== conversationId || pending.turnId !== turnId) continue;
      this.resolvePermission(approvalId, pending, {
        behavior: 'deny',
        message,
        interrupt: true,
      });
    }
  }

  private emitActivity(
    session: ClaudeSession,
    turn: ClaudeTurn,
    activity: ConversationActivity,
  ): void {
    turn.activities.set(activity.id, activity);
    this.emit({
      kind: 'activity.updated',
      conversationId: session.id,
      turnId: turn.id,
      activity,
    });
  }

  private handleAssistant(
    session: ClaudeSession,
    turn: ClaudeTurn,
    message: ClaudeCliMessage,
  ): void {
    const record = asRecord(message);
    const body = asRecord(record.message);
    const blocks = contentBlocks(body);
    const text = textFromBlocks(blocks);
    if (text) {
      this.emit({
        kind: 'message.completed',
        conversationId: session.id,
        turnId: turn.id,
        message: {
          id: turn.assistantMessageId,
          role: 'assistant',
          text,
          createdAt: timestamp(record.timestamp),
        },
      });
    }
    for (const rawBlock of blocks) {
      const block = asRecord(rawBlock);
      if (
        block.type !== 'tool_use' ||
        typeof block.id !== 'string' ||
        typeof block.name !== 'string'
      ) {
        continue;
      }
      const input = asRecord(block.input);
      this.emitActivity(session, turn, {
        id: block.id,
        kind: activityKind(block.name),
        title: bounded(toolTitle(block.name, input), 256),
        status: 'running',
      });
    }
  }

  private handleUserToolResults(
    session: ClaudeSession,
    turn: ClaudeTurn,
    message: ClaudeCliMessage,
  ): void {
    const blocks = contentBlocks(asRecord(asRecord(message).message));
    for (const rawBlock of blocks) {
      const block = asRecord(rawBlock);
      if (block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
      const current = turn.activities.get(block.tool_use_id);
      if (!current) continue;
      const failed = block.is_error === true;
      const detail = failed
        ? bounded(
            typeof block.content === 'string'
              ? block.content
              : textFromBlocks(Array.isArray(block.content) ? block.content : []),
            MAX_DETAIL_CHARS,
          )
        : current.detail;
      this.emitActivity(session, turn, {
        ...current,
        ...(detail ? { detail } : {}),
        status: failed ? 'failed' : 'completed',
      });
    }
  }

  private handleStreamEvent(
    session: ClaudeSession,
    turn: ClaudeTurn,
    message: ClaudeCliMessage,
  ): void {
    const record = asRecord(message);
    const event = asRecord(record.event);
    if (event.type !== 'content_block_delta') return;
    const delta = asRecord(event.delta);
    if (delta.type === 'text_delta' && typeof delta.text === 'string') {
      this.emit({
        kind: 'message.delta',
        conversationId: session.id,
        turnId: turn.id,
        messageId: turn.assistantMessageId,
        delta: bounded(delta.text, MAX_DETAIL_CHARS),
      });
    }
    if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      this.emit({
        kind: 'reasoning.delta',
        conversationId: session.id,
        turnId: turn.id,
        itemId: `reasoning-${turn.id}`,
        delta: bounded(delta.thinking, MAX_DETAIL_CHARS),
      });
    }
  }

  private handleUsage(session: ClaudeSession, turn: ClaudeTurn, message: ClaudeCliMessage): void {
    const usage = asRecord(asRecord(message).usage);
    const inputTokens = numberValue(usage.input_tokens);
    const outputTokens = numberValue(usage.output_tokens);
    const cacheCreation = numberValue(usage.cache_creation_input_tokens) ?? 0;
    const cacheRead = numberValue(usage.cache_read_input_tokens) ?? 0;
    this.emit({
      kind: 'usage.updated',
      conversationId: session.id,
      turnId: turn.id,
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(outputTokens === undefined ? {} : { outputTokens }),
      ...(inputTokens === undefined
        ? {}
        : { contextUsed: inputTokens + cacheCreation + cacheRead }),
      ...(inputTokens === undefined && outputTokens === undefined
        ? {}
        : { totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0) }),
    });
  }

  private handleToolProgress(
    session: ClaudeSession,
    turn: ClaudeTurn,
    message: ClaudeCliMessage,
  ): void {
    const record = asRecord(message);
    if (typeof record.tool_use_id !== 'string' || typeof record.tool_name !== 'string') return;
    const current = turn.activities.get(record.tool_use_id);
    this.emitActivity(session, turn, {
      id: record.tool_use_id,
      kind: current?.kind ?? activityKind(record.tool_name),
      title: current?.title ?? record.tool_name,
      ...(current?.detail ? { detail: current.detail } : {}),
      status: 'running',
    });
  }

  private async cleanupBrowserTurn(turn: ClaudeTurn): Promise<void> {
    const browserSession = turn.browserSession;
    if (!browserSession) return;
    delete turn.browserSession;
    await (
      this.options.closeBrowserSession ??
      (session =>
        closeClaudeBrowserSession(session, {
          environment: this.options.environment,
          platform: this.options.platform,
          runner: this.options.runner,
        }))
    )(browserSession);
  }

  private async cleanupPermissionTurn(turn: ClaudeTurn): Promise<void> {
    const permissionServer = turn.permissionServer;
    if (!permissionServer) return;
    delete turn.permissionServer;
    await permissionServer.close();
  }

  private async consume(session: ClaudeSession, turn: ClaudeTurn): Promise<void> {
    let terminalError: string | undefined;
    let receivedResult = false;
    try {
      for await (const message of turn.query) {
        session.persisted = true;
        const record = asRecord(message);
        if (
          (record.parent_tool_use_id !== undefined && record.parent_tool_use_id !== null) ||
          typeof record.parentToolUseId === 'string' ||
          record.isSidechain === true ||
          record.teamName
        ) {
          continue;
        }
        if (record.type === 'control_request' || record.type === 'control_cancel_request') {
          throw new Error('Claude Code emitted an unsupported internal control request');
        }
        if (record.type === 'stream_event') this.handleStreamEvent(session, turn, message);
        if (record.type === 'assistant') this.handleAssistant(session, turn, message);
        if (record.type === 'user') this.handleUserToolResults(session, turn, message);
        if (record.type === 'tool_progress') this.handleToolProgress(session, turn, message);
        if (record.type === 'result') {
          receivedResult = true;
          this.handleUsage(session, turn, message);
          if (record.subtype !== 'success') {
            const errors = Array.isArray(record.errors)
              ? record.errors.filter((value): value is string => typeof value === 'string')
              : [];
            terminalError = bounded(errors.join('\n') || 'Claude Code turn failed');
          }
        }
      }
      if (!receivedResult && !turn.interrupted) {
        terminalError = 'Claude Code ended without a terminal result';
      }
    } catch (error) {
      if (!turn.interrupted) {
        terminalError = bounded(error instanceof Error ? error.message : String(error));
        this.emit({ kind: 'error', conversationId: session.id, message: terminalError });
      }
    } finally {
      await this.denyPermissions(session.id, turn.id, 'Turn ended before approval was resolved');
      turn.query.close();
      await this.cleanupPermissionTurn(turn).catch(error => {
        this.emit({
          kind: 'error',
          conversationId: session.id,
          message: `Permission server cleanup failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      });
      await this.cleanupBrowserTurn(turn).catch(error => {
        this.emit({
          kind: 'error',
          conversationId: session.id,
          message: `Browser session cleanup failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      });
      if (session.activeTurn === turn) delete session.activeTurn;
      this.emit({
        kind: 'turn.completed',
        conversationId: session.id,
        turnId: turn.id,
        status: turn.interrupted ? 'interrupted' : terminalError ? 'failed' : 'completed',
        ...(terminalError && !turn.interrupted ? { error: terminalError } : {}),
      });
    }
  }

  async close(): Promise<void> {
    const turns = [...this.sessions.values()]
      .map(session => session.activeTurn)
      .filter((turn): turn is ClaudeTurn => Boolean(turn));
    for (const turn of turns) {
      turn.interrupted = true;
    }
    for (const session of this.sessions.values()) {
      if (session.activeTurn) {
        await this.denyPermissions(session.id, session.activeTurn.id, 'Provider closed');
      }
    }
    for (const turn of turns) turn.query.close();
    await Promise.all(
      turns.flatMap(turn => [
        this.cleanupPermissionTurn(turn).catch(() => {}),
        this.cleanupBrowserTurn(turn).catch(() => {}),
      ]),
    );
    this.sessions.clear();
    this.pendingPermissions.clear();
    this.config = null;
  }
}
