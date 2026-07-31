import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { homedir } from 'node:os';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
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
import { resolveSpawnCommand, runCommand, type CommandRunner } from './platform.js';
import {
  qoderInstallCommand,
  resolveQoderExecutable,
  type QoderExecutableResolution,
} from './qoder-executable.js';
import { readRuntimeConfig, type PanerelayRuntimeConfig } from './runtime-config.js';

const QODER_PROVIDER_ID = 'qoder';
const REQUEST_TIMEOUT_MS = 30_000;
const BROWSER_CLEANUP_TIMEOUT_MS = 5_000;
const MAX_TEXT_CHARS = 64 * 1024;
const MAX_DELTA_CHARS = 8 * 1024;

interface QoderRuntimeHandlers {
  onDiagnostic: (message: string) => void;
  onExit: (message: string) => void;
  onPermission: (
    requestId: number | string,
    request: acp.RequestPermissionRequest,
  ) => Promise<acp.RequestPermissionResponse>;
  onUpdate: (notification: acp.SessionNotification) => void;
}

export interface QoderRuntime {
  close(): Promise<void>;
  notify(method: string, params: unknown): Promise<void>;
  request(method: string, params: unknown): Promise<unknown>;
  start(): Promise<acp.InitializeResponse>;
}

export interface QoderProviderOptions {
  closeBrowserSession?: (session: QoderBrowserSession) => Promise<void>;
  createRuntime?: (executable: string, handlers: QoderRuntimeHandlers) => QoderRuntime;
  cwd?: () => string;
  environment?: NodeJS.ProcessEnv;
  onDiagnostic?: (message: string) => void;
  platform?: NodeJS.Platform;
  requestTimeoutMs?: number;
  resolveExecutable?: () => Promise<QoderExecutableResolution>;
  runtimeConfig?: () => Promise<PanerelayRuntimeConfig>;
}

export interface QoderBrowserSession {
  configPath: string;
  executable: string;
  label: string;
}

interface QoderSession {
  activeTurn?: QoderTurn;
  browserCleanup?: Promise<void>;
  browserSession?: QoderBrowserSession;
  cwd: string;
  initialContext?: string;
  summary: ConversationSummary;
}

interface QoderTurn {
  assistantMessageId: string;
  assistantText: string;
  id: string;
  reasoningItemId: string;
}

interface PendingPermission {
  conversationId: string;
  decisionOptions: Map<ConversationApprovalDecision, string>;
  resolve: (response: acp.RequestPermissionResponse) => void;
  turnId: string;
}

interface HistoryCapture {
  messages: ConversationMessage[];
  messageIndexes: Map<string, number>;
  nextId: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function bounded(value: string, maximum = MAX_TEXT_CHARS): string {
  return value.slice(0, maximum);
}

function timestamp(value?: string | null): string {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return new Date(Number.isNaN(parsed) ? Date.now() : parsed).toISOString();
}

function summaryFromSession(session: acp.SessionInfo): ConversationSummary {
  const updatedAt = timestamp(session.updatedAt);
  return {
    id: session.sessionId,
    providerId: QODER_PROVIDER_ID,
    title: bounded(session.title?.trim() || 'Qoder conversation', 128),
    preview: '',
    status: 'idle',
    createdAt: updatedAt,
    updatedAt,
  };
}

function planText(entries: acp.PlanEntry[]): string {
  return bounded(
    entries
      .map(entry => {
        const marker =
          entry.status === 'completed' ? '✓' : entry.status === 'in_progress' ? '→' : '•';
        return `${marker} ${entry.content}`;
      })
      .join('\n'),
  );
}

function activityKind(update: acp.ToolCall | acp.ToolCallUpdate): ConversationActivity['kind'] {
  if (update.title?.toLowerCase().includes('browser')) return 'browser';
  switch (update.kind) {
    case 'execute':
      return 'command';
    case 'edit':
    case 'delete':
    case 'move':
      return 'file-change';
    case 'search':
      return 'web-search';
    default:
      return 'tool';
  }
}

function activityStatus(
  status: acp.ToolCallStatus | null | undefined,
): ConversationActivity['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'running';
}

function failedToolDetail(update: acp.ToolCall | acp.ToolCallUpdate): string | undefined {
  if (update.status !== 'failed') return undefined;
  const detail = (update.content ?? [])
    .flatMap(item =>
      item.type === 'content' && item.content.type === 'text' ? [item.content.text.trim()] : [],
    )
    .filter(Boolean)
    .join('\n');
  return detail ? bounded(detail, MAX_DELTA_CHARS) : undefined;
}

function qoderBrowserSession(
  config: PanerelayRuntimeConfig,
  sessionLabel: string,
): QoderBrowserSession | undefined {
  if (!config.agentBrowserPath || !config.agentBrowserConfigPath) return undefined;
  return {
    configPath: config.agentBrowserConfigPath,
    executable: config.agentBrowserPath,
    label: sessionLabel,
  };
}

export function qoderBrowserMcpServers(
  config: PanerelayRuntimeConfig,
  sessionLabel: string,
  browserId = process.env[PANERELAY_BROWSER_ID_ENV],
): acp.McpServer[] {
  const browserSession = qoderBrowserSession(config, sessionLabel);
  if (!browserSession) return [];
  return [
    {
      name: 'panerelay_browser',
      command: browserSession.executable,
      args: ['mcp', '--tools', 'core,tabs'],
      env: [
        { name: 'AGENT_BROWSER_CONFIG', value: browserSession.configPath },
        { name: 'AGENT_BROWSER_PROVIDER', value: 'panerelay' },
        { name: 'AGENT_BROWSER_SESSION', value: browserSession.label },
        ...(browserId ? [{ name: PANERELAY_BROWSER_ID_ENV, value: browserId }] : []),
      ],
    },
  ];
}

export async function closeQoderBrowserSession(
  session: QoderBrowserSession,
  options: {
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    runner?: CommandRunner;
    timeoutMs?: number;
  } = {},
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
    timeoutMs: options.timeoutMs ?? BROWSER_CLEANUP_TIMEOUT_MS,
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (result.code !== 0) {
    throw new Error(`agent-browser cleanup exited with code ${result.code}`);
  }
}

export class QoderProcessRuntime implements QoderRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private connection: acp.ClientConnection | null = null;
  private starting: Promise<acp.InitializeResponse> | null = null;
  private closing = false;
  private stderrBytes = 0;

  constructor(
    private readonly executable: string,
    private readonly handlers: QoderRuntimeHandlers,
    private readonly options: {
      environment?: NodeJS.ProcessEnv;
      platform?: NodeJS.Platform;
      timeoutMs?: number;
    } = {},
  ) {}

  async start(): Promise<acp.InitializeResponse> {
    if (this.connection) {
      throw new Error('Qoder ACP is already running without cached initialization state');
    }
    if (this.starting) return this.starting;
    this.starting = this.launch();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async request(method: string, params: unknown): Promise<unknown> {
    if (!this.connection) throw new Error('Qoder ACP is not running');
    return this.connection.agent.request(method, params);
  }

  async notify(method: string, params: unknown): Promise<void> {
    if (!this.connection) throw new Error('Qoder ACP is not running');
    await this.connection.agent.notify(method, params);
  }

  async close(): Promise<void> {
    this.closing = true;
    const connection = this.connection;
    const child = this.child;
    this.connection = null;
    this.child = null;
    connection?.close();
    if (!child || child.exitCode !== null || child.killed) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 1_000);
      timer.unref();
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }

  private async launch(): Promise<acp.InitializeResponse> {
    this.closing = false;
    this.stderrBytes = 0;
    const environment = this.options.environment ?? process.env;
    const launch = resolveSpawnCommand(
      this.executable,
      ['--acp'],
      this.options.platform,
      environment.ComSpec,
    );
    const child = spawn(launch.command, launch.args, {
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
      windowsHide: true,
    });
    this.child = child;
    child.stderr.on('data', chunk => {
      this.stderrBytes += (chunk as Buffer).length;
    });
    child.once('error', error => this.handleExit(`Qoder ACP failed to start: ${error.message}`));
    child.once('exit', (code, signal) => {
      this.handleExit(`Qoder ACP exited (code=${String(code)}, signal=${String(signal)})`);
    });

    const stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
    );
    const app = acp
      .client({ name: 'panerelay' })
      .onRequest(acp.methods.client.session.requestPermission, context => {
        if (context.requestId === undefined || context.requestId === null) {
          return { outcome: { outcome: 'cancelled' as const } };
        }
        return this.handlers.onPermission(context.requestId, context.params);
      })
      .onNotification(acp.methods.client.session.update, context => {
        this.handlers.onUpdate(context.params);
      });
    const connection = app.connect(stream);
    this.connection = connection;
    try {
      const initialized = (await this.withTimeout(
        connection.agent.request(acp.methods.agent.initialize, {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {},
          clientInfo: {
            name: 'panerelay',
            title: 'Panerelay',
            version: '0.1.0',
          },
        }),
        'Qoder ACP initialization',
      )) as acp.InitializeResponse;
      if (initialized.protocolVersion !== acp.PROTOCOL_VERSION) {
        throw new Error(
          `Qoder ACP protocol ${initialized.protocolVersion} is incompatible with ${acp.PROTOCOL_VERSION}`,
        );
      }
      return initialized;
    } catch (error) {
      connection.close(error);
      if (!child.killed) child.kill('SIGTERM');
      this.connection = null;
      this.child = null;
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          this.options.timeoutMs ?? REQUEST_TIMEOUT_MS,
        );
        timer.unref();
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private handleExit(message: string): void {
    if (!this.child && !this.connection) return;
    const connection = this.connection;
    this.child = null;
    this.connection = null;
    connection?.close(new Error(message));
    if (this.stderrBytes > 0) {
      this.handlers.onDiagnostic(`Qoder ACP wrote ${this.stderrBytes} byte(s) to stderr`);
    }
    if (!this.closing) this.handlers.onExit(message);
  }
}

export class QoderProvider implements AgentProvider {
  readonly id = QODER_PROVIDER_ID;
  private runtime: QoderRuntime | null = null;
  private runtimeStart: Promise<void> | null = null;
  private initializeResponse: acp.InitializeResponse | null = null;
  private runtimeConfigValue: PanerelayRuntimeConfig | null = null;
  private resolution: QoderExecutableResolution | null = null;
  private readonly listeners = new Set<(event: ConversationEvent) => void>();
  private readonly sessions = new Map<string, QoderSession>();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly historyCaptures = new Map<string, HistoryCapture>();
  private nextApprovalId = 1;

  constructor(private readonly options: QoderProviderOptions = {}) {}

  async getDescriptor(): Promise<AgentProviderSummary> {
    const setup = {
      installCommand: qoderInstallCommand(this.options.platform),
      loginCommand: 'qodercli',
      docsUrl: 'https://docs.qoder.com/en/cli/quick-start',
    };
    try {
      const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
      const resolution = this.options.resolveExecutable
        ? await this.options.resolveExecutable()
        : await resolveQoderExecutable({
            configuredPath: config.qoderPath,
            environment: this.options.environment,
            platform: this.options.platform,
          });
      this.resolution = resolution;
      if (!resolution.executable) {
        throw new Error(resolution.error || 'Qoder CLI is unavailable');
      }
      const capabilities = this.initializeResponse?.agentCapabilities;
      return {
        id: this.id,
        name: 'Qoder',
        status: 'ready',
        description: 'Local Qoder CLI through capability-negotiated ACP sessions.',
        setup,
        ...(this.resolution?.version ? { version: this.resolution.version } : {}),
        capabilities: {
          approvals: true,
          imageInput: capabilities?.promptCapabilities?.image === true,
          interrupt: true,
          listConversations: Boolean(capabilities?.sessionCapabilities?.list),
          resume: Boolean(capabilities?.loadSession || capabilities?.sessionCapabilities?.resume),
          streaming: true,
        },
      };
    } catch (error) {
      return {
        id: this.id,
        name: 'Qoder',
        status: 'unavailable',
        description: 'Local Qoder CLI through capability-negotiated ACP sessions.',
        setup,
        setupHint: `${errorMessage(error)} Install with: ${setup.installCommand}; then run qodercli to sign in.`,
      };
    }
  }

  onEvent(listener: (event: ConversationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async prepare(): Promise<void> {
    await this.ensureRuntime();
  }

  async listConversations(cwd?: string): Promise<ConversationSummary[]> {
    await this.ensureRuntime();
    if (!this.initializeResponse?.agentCapabilities?.sessionCapabilities?.list) {
      throw new Error('This Qoder CLI does not advertise ACP session listing');
    }
    const result = (await this.request(
      acp.methods.agent.session.list,
      { cursor: null, ...(cwd ? { cwd } : {}) },
      'Qoder session list',
    )) as acp.ListSessionsResponse;
    return result.sessions.map(summaryFromSession);
  }

  async startConversation(options: ConversationStartOptions = {}): Promise<ConversationDetail> {
    await this.ensureRuntime();
    const config = this.getRuntimeConfig();
    const resolvedOptions = resolveConversationStartOptions(options);
    const cwd = resolvedOptions.cwd ?? (this.options.cwd ?? homedir)();
    const sessionLabel = `panerelay-qoder-${randomUUID()}`;
    const browserSession = qoderBrowserSession(config, sessionLabel);
    let result: acp.NewSessionResponse;
    try {
      result = (await this.request(
        acp.methods.agent.session.new,
        {
          cwd,
          mcpServers: qoderBrowserMcpServers(
            config,
            sessionLabel,
            (this.options.environment ?? process.env)[PANERELAY_BROWSER_ID_ENV],
          ),
        },
        'Qoder session creation',
      )) as acp.NewSessionResponse;
      if (!result.sessionId) throw new Error('Qoder did not return a conversation ID');
    } catch (error) {
      await this.closeOwnedBrowserSession(browserSession);
      throw error;
    }
    const now = new Date().toISOString();
    const summary: ConversationSummary = {
      id: result.sessionId,
      providerId: this.id,
      title: 'New Qoder conversation',
      preview: '',
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    const initialContext = createConversationContextInstructions(resolvedOptions);
    this.sessions.set(result.sessionId, {
      browserSession,
      cwd,
      ...(initialContext ? { initialContext } : {}),
      summary,
    });
    return { conversation: summary, messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    await this.ensureRuntime();
    const capabilities = this.initializeResponse?.agentCapabilities;
    if (!capabilities?.loadSession && !capabilities?.sessionCapabilities?.resume) {
      throw new Error('This Qoder CLI does not advertise ACP session resume or load');
    }
    const config = this.getRuntimeConfig();
    const cwd = (this.options.cwd ?? homedir)();
    const sessionLabel = `panerelay-qoder-${randomUUID()}`;
    const browserSession = qoderBrowserSession(config, sessionLabel);
    const request = {
      sessionId: conversationId,
      cwd,
      mcpServers: qoderBrowserMcpServers(
        config,
        sessionLabel,
        (this.options.environment ?? process.env)[PANERELAY_BROWSER_ID_ENV],
      ),
    };
    let messages: ConversationMessage[] = [];
    try {
      if (capabilities?.loadSession) {
        const capture: HistoryCapture = {
          messages: [],
          messageIndexes: new Map(),
          nextId: 1,
        };
        this.historyCaptures.set(conversationId, capture);
        try {
          await this.request(acp.methods.agent.session.load, request, 'Qoder session load');
          messages = capture.messages;
        } finally {
          this.historyCaptures.delete(conversationId);
        }
      } else if (capabilities?.sessionCapabilities?.resume) {
        await this.request(acp.methods.agent.session.resume, request, 'Qoder session resume');
      }
    } catch (error) {
      await this.closeOwnedBrowserSession(browserSession);
      throw error;
    }
    const now = new Date().toISOString();
    const summary: ConversationSummary = {
      id: conversationId,
      providerId: this.id,
      title: 'Qoder conversation',
      preview: messages.at(-1)?.text.slice(0, 128) || '',
      status: 'idle',
      createdAt: messages[0]?.createdAt || now,
      updatedAt: messages.at(-1)?.createdAt || now,
    };
    this.sessions.set(conversationId, { browserSession, cwd, summary });
    return { conversation: summary, messages };
  }

  async sendMessage(
    conversationId: string,
    text: string,
    images: ConversationImageInput[] = [],
  ): Promise<{ turnId: string }> {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) throw new Error('Message cannot be empty');
    await this.ensureRuntime();
    if (
      images.length > 0 &&
      this.initializeResponse?.agentCapabilities?.promptCapabilities?.image !== true
    ) {
      throw new Error('Qoder does not support image input');
    }
    const session = this.sessions.get(conversationId);
    if (!session) throw new Error(`Unknown Qoder conversation: ${conversationId}`);
    if (session.activeTurn) throw new Error('The current Qoder turn has not finished');
    const turnId = `qoder-turn-${randomUUID()}`;
    const turn: QoderTurn = {
      assistantMessageId: `${turnId}-message`,
      assistantText: '',
      id: turnId,
      reasoningItemId: `${turnId}-reasoning`,
    };
    session.activeTurn = turn;
    this.emit({ kind: 'turn.started', conversationId, turnId });
    const prompt = session.initialContext
      ? `${session.initialContext}${trimmed ? `\n\n${trimmed}` : ''}`
      : trimmed;
    delete session.initialContext;
    const promptContent: acp.ContentBlock[] = [
      ...(prompt ? [{ type: 'text' as const, text: prompt }] : []),
      ...images.map(image => ({
        type: 'image' as const,
        data: image.data,
        mimeType: image.mimeType,
      })),
    ];
    void this.runPrompt(conversationId, session, turn, promptContent);
    return { turnId };
  }

  async interrupt(conversationId: string, _turnId: string): Promise<Record<string, never>> {
    await this.ensureRuntime();
    if (!this.sessions.has(conversationId)) {
      throw new Error(`Unknown Qoder conversation: ${conversationId}`);
    }
    await this.runtime!.notify(acp.methods.agent.session.cancel, {
      sessionId: conversationId,
    });
    this.cancelPermissions(conversationId);
    return {};
  }

  async respondToApproval(
    conversationId: string,
    approvalId: string,
    decision: ConversationApprovalDecision,
  ): Promise<Record<string, never>> {
    const pending = this.pendingPermissions.get(approvalId);
    if (!pending || pending.conversationId !== conversationId) {
      throw new Error('This Qoder permission is no longer pending');
    }
    if (decision === 'cancel') {
      pending.resolve({ outcome: { outcome: 'cancelled' } });
    } else {
      const optionId = pending.decisionOptions.get(decision);
      if (!optionId) throw new Error('Qoder did not offer that permission decision');
      pending.resolve({ outcome: { outcome: 'selected', optionId } });
    }
    this.pendingPermissions.delete(approvalId);
    this.emit({
      kind: 'approval.resolved',
      conversationId,
      turnId: pending.turnId,
      approvalId,
    });
    return {};
  }

  async close(): Promise<void> {
    this.cancelPermissions();
    this.historyCaptures.clear();
    const runtime = this.runtime;
    const sessions = [...this.sessions.values()];
    const closeSupported = this.initializeResponse?.agentCapabilities?.sessionCapabilities?.close;
    if (runtime && closeSupported) {
      await Promise.allSettled(
        [...this.sessions.keys()].map(conversationId =>
          this.request(
            acp.methods.agent.session.close,
            { sessionId: conversationId },
            'Qoder session close',
          ),
        ),
      );
    }
    this.sessions.clear();
    this.runtime = null;
    this.runtimeStart = null;
    this.initializeResponse = null;
    this.runtimeConfigValue = null;
    this.resolution = null;
    await runtime?.close();
    await Promise.all(sessions.map(session => this.closeSessionBrowser(session)));
  }

  private async ensureRuntime(): Promise<void> {
    if (this.runtime && this.initializeResponse) return;
    if (this.runtimeStart) return this.runtimeStart;
    this.runtimeStart = this.startRuntime();
    try {
      await this.runtimeStart;
    } finally {
      this.runtimeStart = null;
    }
  }

  private async startRuntime(): Promise<void> {
    const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
    const resolution = this.options.resolveExecutable
      ? await this.options.resolveExecutable()
      : await resolveQoderExecutable({
          configuredPath: config.qoderPath,
          environment: this.options.environment,
          platform: this.options.platform,
        });
    this.resolution = resolution;
    if (!resolution.executable) {
      throw new Error(resolution.error || 'Qoder CLI is unavailable');
    }
    const runtimeReference: { value?: QoderRuntime } = {};
    const handlers: QoderRuntimeHandlers = {
      onDiagnostic: message => this.options.onDiagnostic?.(message),
      onExit: message => {
        if (runtimeReference.value) this.handleRuntimeExit(runtimeReference.value, message);
      },
      onPermission: (requestId, request) => this.handlePermissionRequest(requestId, request),
      onUpdate: notification => this.handleUpdate(notification),
    };
    const runtime = this.options.createRuntime
      ? this.options.createRuntime(resolution.executable, handlers)
      : new QoderProcessRuntime(resolution.executable, handlers, {
          environment: this.options.environment,
          timeoutMs: this.options.requestTimeoutMs,
        });
    runtimeReference.value = runtime;
    this.runtime = runtime;
    this.runtimeConfigValue = config;
    try {
      this.initializeResponse = await runtime.start();
    } catch (error) {
      if (this.runtime === runtime) this.runtime = null;
      this.initializeResponse = null;
      this.runtimeConfigValue = null;
      await runtime.close().catch(() => {});
      throw new Error(`Qoder ACP failed to initialize: ${errorMessage(error)}`, { cause: error });
    }
  }

  private getRuntimeConfig(): PanerelayRuntimeConfig {
    if (!this.runtimeConfigValue) throw new Error('Qoder runtime configuration is unavailable');
    return this.runtimeConfigValue;
  }

  private async request(method: string, params: unknown, label: string): Promise<unknown> {
    if (!this.runtime) throw new Error('Qoder ACP is unavailable');
    let timer: NodeJS.Timeout | undefined;
    return Promise.race([
      this.runtime.request(method, params),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          this.options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
        );
        timer.unref();
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private async runPrompt(
    conversationId: string,
    session: QoderSession,
    turn: QoderTurn,
    prompt: acp.ContentBlock[],
  ): Promise<void> {
    let terminalEvent: ConversationEvent;
    try {
      const result = (await this.request(
        acp.methods.agent.session.prompt,
        {
          sessionId: conversationId,
          prompt,
        },
        'Qoder prompt',
      )) as acp.PromptResponse;
      if (turn.assistantText) {
        this.emit({
          kind: 'message.completed',
          conversationId,
          turnId: turn.id,
          message: {
            id: turn.assistantMessageId,
            role: 'assistant',
            text: turn.assistantText,
            phase: 'final',
            createdAt: new Date().toISOString(),
          },
        });
      }
      if (result.usage) {
        this.emit({
          kind: 'usage.updated',
          conversationId,
          turnId: turn.id,
          totalTokens: result.usage.totalTokens,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        });
      }
      terminalEvent = {
        kind: 'turn.completed',
        conversationId,
        turnId: turn.id,
        status: result.stopReason === 'cancelled' ? 'interrupted' : 'completed',
      };
    } catch (error) {
      this.emit({
        kind: 'error',
        conversationId,
        message: bounded(errorMessage(error), 1_024),
      });
      terminalEvent = {
        kind: 'turn.completed',
        conversationId,
        turnId: turn.id,
        status: 'failed',
        error: bounded(errorMessage(error), 1_024),
      };
    } finally {
      this.cancelPermissions(conversationId);
      await this.closeSessionBrowser(session);
      if (session.activeTurn === turn) {
        delete session.activeTurn;
        this.emit(terminalEvent!);
      }
    }
  }

  private handleUpdate(notification: acp.SessionNotification): void {
    const capture = this.historyCaptures.get(notification.sessionId);
    if (capture) {
      this.captureHistory(capture, notification.update);
      return;
    }
    const session = this.sessions.get(notification.sessionId);
    const turn = session?.activeTurn;
    if (!session || !turn) {
      this.options.onDiagnostic?.(
        `Ignored Qoder update without an active turn: ${notification.update.sessionUpdate}`,
      );
      return;
    }
    const conversationId = notification.sessionId;
    const update = notification.update;
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        if (update.content.type !== 'text') return;
        turn.assistantText = bounded(`${turn.assistantText}${update.content.text}`);
        this.emit({
          kind: 'message.delta',
          conversationId,
          turnId: turn.id,
          messageId: turn.assistantMessageId,
          delta: bounded(update.content.text, MAX_DELTA_CHARS),
          phase: 'final',
        });
        return;
      case 'agent_thought_chunk':
        if (update.content.type !== 'text') return;
        this.emit({
          kind: 'reasoning.delta',
          conversationId,
          turnId: turn.id,
          itemId: turn.reasoningItemId,
          delta: bounded(update.content.text, MAX_DELTA_CHARS),
        });
        return;
      case 'tool_call':
      case 'tool_call_update': {
        const detail = failedToolDetail(update);
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity: {
            id: update.toolCallId,
            kind: activityKind(update),
            title: bounded(update.title || 'Qoder tool', 256),
            ...(detail ? { detail } : {}),
            status: activityStatus(update.status),
          },
        });
        return;
      }
      case 'plan':
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity: {
            id: `${turn.id}-plan`,
            kind: 'other',
            title: 'Qoder plan',
            detail: planText(update.entries),
            status: update.entries.every(entry => entry.status === 'completed')
              ? 'completed'
              : 'running',
          },
        });
        return;
      case 'plan_update': {
        const detail =
          'entries' in update && Array.isArray(update.entries)
            ? planText(update.entries as acp.PlanEntry[])
            : 'Qoder updated its plan';
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity: {
            id: `${turn.id}-plan`,
            kind: 'other',
            title: 'Qoder plan',
            detail,
            status: 'running',
          },
        });
        return;
      }
      case 'plan_removed':
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity: {
            id: `${turn.id}-plan`,
            kind: 'other',
            title: 'Qoder plan',
            status: 'completed',
          },
        });
        return;
      case 'usage_update':
        this.emit({
          kind: 'usage.updated',
          conversationId,
          turnId: turn.id,
          contextUsed: update.used,
          contextSize: update.size,
        });
        return;
      case 'user_message_chunk':
      case 'available_commands_update':
      case 'current_mode_update':
      case 'config_option_update':
      case 'session_info_update':
        this.options.onDiagnostic?.(`Ignored Qoder update: ${update.sessionUpdate}`);
    }
  }

  private captureHistory(capture: HistoryCapture, update: acp.SessionUpdate): void {
    if (
      update.sessionUpdate !== 'user_message_chunk' &&
      update.sessionUpdate !== 'agent_message_chunk'
    ) {
      return;
    }
    if (update.content.type !== 'text') return;
    const role = update.sessionUpdate === 'user_message_chunk' ? 'user' : 'assistant';
    const key = `${role}:${update.messageId || `anonymous-${capture.nextId++}`}`;
    const existingIndex = capture.messageIndexes.get(key);
    if (existingIndex !== undefined) {
      const message = capture.messages[existingIndex];
      if (message) message.text = bounded(`${message.text}${update.content.text}`);
      return;
    }
    capture.messageIndexes.set(key, capture.messages.length);
    capture.messages.push({
      id: update.messageId || `qoder-history-${capture.nextId++}`,
      role,
      text: bounded(update.content.text),
      ...(role === 'assistant' ? { phase: 'final' as const } : {}),
      createdAt: new Date().toISOString(),
    });
  }

  private handlePermissionRequest(
    requestId: number | string,
    request: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const session = this.sessions.get(request.sessionId);
    const turn = session?.activeTurn;
    if (!session || !turn) {
      return Promise.resolve({ outcome: { outcome: 'cancelled' } });
    }
    const decisionOptions = new Map<ConversationApprovalDecision, string>();
    for (const option of request.options) {
      const decision: ConversationApprovalDecision =
        option.kind === 'allow_once'
          ? 'accept'
          : option.kind === 'allow_always'
            ? 'acceptForSession'
            : option.kind === 'reject_once'
              ? 'decline'
              : 'declineForSession';
      if (!decisionOptions.has(decision)) decisionOptions.set(decision, option.optionId);
    }
    if (decisionOptions.size === 0) {
      return Promise.resolve({ outcome: { outcome: 'cancelled' } });
    }
    const approvalId = `qoder:${String(requestId)}:${this.nextApprovalId++}`;
    return new Promise(resolve => {
      this.pendingPermissions.set(approvalId, {
        conversationId: request.sessionId,
        decisionOptions,
        resolve,
        turnId: turn.id,
      });
      const decisions = (
        ['accept', 'acceptForSession', 'decline', 'declineForSession'] as const
      ).filter(decision => decisionOptions.has(decision));
      const approval: ConversationApproval = {
        id: approvalId,
        conversationId: request.sessionId,
        turnId: turn.id,
        kind: 'tool',
        title: bounded(request.toolCall.title || 'Allow Qoder to use this tool?', 256),
        description: 'Qoder requested permission for a tool operation.',
        decisions: [...decisions, 'cancel'],
      };
      this.emit({
        kind: 'approval.requested',
        conversationId: request.sessionId,
        turnId: turn.id,
        approval,
      });
    });
  }

  private cancelPermissions(conversationId?: string): void {
    for (const [approvalId, pending] of this.pendingPermissions) {
      if (conversationId && pending.conversationId !== conversationId) continue;
      this.pendingPermissions.delete(approvalId);
      pending.resolve({ outcome: { outcome: 'cancelled' } });
      this.emit({
        kind: 'approval.resolved',
        conversationId: pending.conversationId,
        turnId: pending.turnId,
        approvalId,
      });
    }
  }

  private handleRuntimeExit(runtime: QoderRuntime, message: string): void {
    if (this.runtime !== runtime) return;
    this.runtime = null;
    this.initializeResponse = null;
    this.runtimeConfigValue = null;
    this.resolution = null;
    this.cancelPermissions();
    const sessions = [...this.sessions.entries()];
    this.sessions.clear();
    const activeTurns: Array<{ conversationId: string; turnId: string }> = [];
    for (const [conversationId, session] of sessions) {
      if (!session.activeTurn) continue;
      activeTurns.push({ conversationId, turnId: session.activeTurn.id });
      delete session.activeTurn;
    }
    void Promise.all(sessions.map(([, session]) => this.closeSessionBrowser(session))).then(() => {
      for (const { conversationId, turnId } of activeTurns) {
        this.emit({
          kind: 'error',
          conversationId,
          message: bounded(message, 1_024),
        });
        this.emit({
          kind: 'turn.completed',
          conversationId,
          turnId,
          status: 'failed',
          error: 'Qoder ACP exited before the turn completed',
        });
      }
    });
  }

  private async closeSessionBrowser(session: QoderSession): Promise<void> {
    if (!session.browserSession) return;
    if (!session.browserCleanup) {
      session.browserCleanup = this.closeOwnedBrowserSession(session.browserSession);
    }
    const cleanup = session.browserCleanup;
    try {
      await cleanup;
    } finally {
      if (session.browserCleanup === cleanup) delete session.browserCleanup;
    }
  }

  private async closeOwnedBrowserSession(session: QoderBrowserSession | undefined): Promise<void> {
    if (!session) return;
    try {
      if (this.options.closeBrowserSession) {
        await this.options.closeBrowserSession(session);
      } else {
        await closeQoderBrowserSession(session, {
          environment: this.options.environment,
          platform: this.options.platform,
        });
      }
    } catch {
      this.options.onDiagnostic?.(`Failed to close Qoder browser session ${session.label}`);
    }
  }

  private emit(event: ConversationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
