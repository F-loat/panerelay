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
import type { AgentProvider } from './agent-provider.js';
import { normalizeAcpHistoryMessages, wrapAcpConversationContext } from './acp-context.js';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
} from './agent-context.js';
import { readBrowserAutomationSetupHint } from './browser-automation-hints.js';
import { resolveSpawnCommand } from './platform.js';
import { readRuntimeConfig, type PanerelayRuntimeConfig } from './runtime-config.js';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 64 * 1024;
const MAX_DELTA_CHARS = 8 * 1024;
const MAX_MODEL_CHARS = 256;

export interface AcpExecutableResolution {
  error?: string;
  executable?: string;
  version?: string;
}

export interface AcpProviderProfile {
  description: string;
  docsUrl: string;
  id: string;
  installCommand: (platform?: NodeJS.Platform) => string;
  launchArgs: string[];
  loginCommand: string;
  name: string;
  resolveExecutable: (options: {
    config: PanerelayRuntimeConfig;
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
  }) => Promise<AcpExecutableResolution>;
}

export interface AcpRuntimeHandlers {
  onDiagnostic: (message: string) => void;
  onExit: (message: string) => void;
  onPermission: (
    requestId: number | string,
    request: acp.RequestPermissionRequest,
  ) => Promise<acp.RequestPermissionResponse>;
  onUpdate: (notification: acp.SessionNotification) => void;
}

export interface AcpRuntime {
  close(): Promise<void>;
  notify(method: string, params: unknown): Promise<void>;
  request(method: string, params: unknown): Promise<unknown>;
  start(): Promise<acp.InitializeResponse>;
}

export interface AcpProviderOptions {
  createRuntime?: (
    executable: string,
    handlers: AcpRuntimeHandlers,
    options: {
      environment?: NodeJS.ProcessEnv;
      platform?: NodeJS.Platform;
      timeoutMs?: number;
    },
  ) => AcpRuntime;
  cwd?: () => string;
  environment?: NodeJS.ProcessEnv;
  onDiagnostic?: (message: string) => void;
  platform?: NodeJS.Platform;
  requestTimeoutMs?: number;
  resolveExecutable?: () => Promise<AcpExecutableResolution>;
  runtimeConfig?: () => Promise<PanerelayRuntimeConfig>;
}

interface AcpSession {
  activeTurn?: AcpTurn;
  cwd: string;
  initialContext?: string;
  summary: ConversationSummary;
}

interface AcpTurn {
  activities: Map<string, ConversationActivity>;
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

function modelFromConfigOptions(
  configOptions: acp.SessionConfigOption[] | null | undefined,
): string | undefined {
  const option = configOptions?.find(item => item.category === 'model' || item.id === 'model');
  if (!option || option.type !== 'select') return undefined;
  const currentValue = option.currentValue.trim();
  if (!currentValue) return undefined;
  const values = option.options.flatMap(item => ('options' in item ? item.options : [item]));
  const selected = values.find(item => item.value === currentValue);
  return bounded(selected?.name.trim() || currentValue, MAX_MODEL_CHARS);
}

function timestamp(value?: string | null): string {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return new Date(Number.isNaN(parsed) ? Date.now() : parsed).toISOString();
}

function summaryFromSession(
  session: acp.SessionInfo,
  profile: AcpProviderProfile,
): ConversationSummary {
  const updatedAt = timestamp(session.updatedAt);
  return {
    id: session.sessionId,
    providerId: profile.id,
    title: bounded(session.title?.trim() || `${profile.name} conversation`, 128),
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

function displayableToolText(update: acp.ToolCall | acp.ToolCallUpdate): string | undefined {
  const text = (update.content ?? [])
    .flatMap(item =>
      item.type === 'content' && item.content.type === 'text' ? [item.content.text.trim()] : [],
    )
    .filter(Boolean)
    .join('\n');
  return text ? bounded(text, MAX_DELTA_CHARS) : undefined;
}

export class AcpProcessRuntime implements AcpRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private connection: acp.ClientConnection | null = null;
  private starting: Promise<acp.InitializeResponse> | null = null;
  private closing = false;
  private stderrBytes = 0;

  constructor(
    private readonly executable: string,
    private readonly handlers: AcpRuntimeHandlers,
    private readonly options: {
      environment?: NodeJS.ProcessEnv;
      label: string;
      launchArgs: string[];
      platform?: NodeJS.Platform;
      timeoutMs?: number;
    },
  ) {}

  async start(): Promise<acp.InitializeResponse> {
    if (this.connection) {
      throw new Error(
        `${this.options.label} ACP is already running without cached initialization state`,
      );
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
    if (!this.connection) throw new Error(`${this.options.label} ACP is not running`);
    return this.connection.agent.request(method, params);
  }

  async notify(method: string, params: unknown): Promise<void> {
    if (!this.connection) throw new Error(`${this.options.label} ACP is not running`);
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
      this.options.launchArgs,
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
    child.once('error', error =>
      this.handleExit(`${this.options.label} ACP failed to start: ${error.message}`),
    );
    child.once('exit', (code, signal) => {
      this.handleExit(
        `${this.options.label} ACP exited (code=${String(code)}, signal=${String(signal)})`,
      );
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
        `${this.options.label} ACP initialization`,
      )) as acp.InitializeResponse;
      if (initialized.protocolVersion !== acp.PROTOCOL_VERSION) {
        throw new Error(
          `${this.options.label} ACP protocol ${initialized.protocolVersion} is incompatible with ${acp.PROTOCOL_VERSION}`,
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
      this.handlers.onDiagnostic(
        `${this.options.label} ACP wrote ${this.stderrBytes} byte(s) to stderr`,
      );
    }
    if (!this.closing) this.handlers.onExit(message);
  }
}

export class AcpProvider implements AgentProvider {
  readonly id: string;
  private runtime: AcpRuntime | null = null;
  private runtimeStart: Promise<void> | null = null;
  private initializeResponse: acp.InitializeResponse | null = null;
  private resolution: AcpExecutableResolution | null = null;
  private readonly listeners = new Set<(event: ConversationEvent) => void>();
  private readonly sessions = new Map<string, AcpSession>();
  private readonly sessionDirectories = new Map<string, string>();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly historyCaptures = new Map<string, HistoryCapture>();
  private nextApprovalId = 1;

  constructor(
    private readonly profile: AcpProviderProfile,
    private readonly options: AcpProviderOptions = {},
  ) {
    this.id = profile.id;
  }

  async getDescriptor(): Promise<AgentProviderSummary> {
    const setup = {
      installCommand: this.profile.installCommand(this.options.platform),
      loginCommand: this.profile.loginCommand,
      docsUrl: this.profile.docsUrl,
    };
    try {
      const config = await (this.options.runtimeConfig ?? readRuntimeConfig)();
      const resolution = this.options.resolveExecutable
        ? await this.options.resolveExecutable()
        : await this.profile.resolveExecutable({
            config,
            environment: this.options.environment,
            platform: this.options.platform,
          });
      this.resolution = resolution;
      if (!resolution.executable) {
        throw new Error(resolution.error || `${this.profile.name} CLI is unavailable`);
      }
      const capabilities = this.initializeResponse?.agentCapabilities;
      return {
        id: this.id,
        name: this.profile.name,
        status: 'ready',
        description: this.profile.description,
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
        name: this.profile.name,
        status: 'unavailable',
        description: this.profile.description,
        setup,
        setupHint: `${errorMessage(error)} Install with: ${setup.installCommand}; then run ${setup.loginCommand} to sign in.`,
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
      throw new Error(`This ${this.profile.name} CLI does not advertise ACP session listing`);
    }
    const result = (await this.request(
      acp.methods.agent.session.list,
      { cursor: null, ...(cwd ? { cwd } : {}) },
      `${this.profile.name} session list`,
    )) as acp.ListSessionsResponse;
    return result.sessions.map(session => {
      if (session.cwd) this.sessionDirectories.set(session.sessionId, session.cwd);
      return summaryFromSession(session, this.profile);
    });
  }

  async startConversation(options: ConversationStartOptions = {}): Promise<ConversationDetail> {
    await this.ensureRuntime();
    const resolvedOptions = resolveConversationStartOptions(options);
    const cwd = resolvedOptions.cwd ?? (this.options.cwd ?? homedir)();
    const result = (await this.request(
      acp.methods.agent.session.new,
      { cwd, mcpServers: [] },
      `${this.profile.name} session creation`,
    )) as acp.NewSessionResponse;
    if (!result.sessionId) {
      throw new Error(`${this.profile.name} did not return a conversation ID`);
    }
    const now = new Date().toISOString();
    const model = modelFromConfigOptions(result.configOptions);
    const summary: ConversationSummary = {
      id: result.sessionId,
      providerId: this.id,
      ...(model ? { model } : {}),
      title: `New ${this.profile.name} conversation`,
      preview: '',
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    const initialContext = createConversationContextInstructions(
      resolvedOptions,
      await readBrowserAutomationSetupHint(),
    );
    this.sessions.set(result.sessionId, {
      cwd,
      ...(initialContext ? { initialContext } : {}),
      summary,
    });
    this.sessionDirectories.set(result.sessionId, cwd);
    return { conversation: summary, messages: [] };
  }

  async resumeConversation(conversationId: string): Promise<ConversationDetail> {
    await this.ensureRuntime();
    const capabilities = this.initializeResponse?.agentCapabilities;
    if (!capabilities?.loadSession && !capabilities?.sessionCapabilities?.resume) {
      throw new Error(
        `This ${this.profile.name} CLI does not advertise ACP session resume or load`,
      );
    }
    const cwd =
      this.sessions.get(conversationId)?.cwd ??
      this.sessionDirectories.get(conversationId) ??
      (this.options.cwd ?? homedir)();
    const request = {
      sessionId: conversationId,
      cwd,
      mcpServers: [],
    };
    let messages: ConversationMessage[] = [];
    let configOptions: acp.SessionConfigOption[] | null | undefined;
    if (capabilities?.loadSession) {
      const capture: HistoryCapture = {
        messages: [],
        messageIndexes: new Map(),
        nextId: 1,
      };
      this.historyCaptures.set(conversationId, capture);
      try {
        const result = (await this.request(
          acp.methods.agent.session.load,
          request,
          `${this.profile.name} session load`,
        )) as acp.LoadSessionResponse;
        configOptions = result.configOptions;
        messages = normalizeAcpHistoryMessages(capture.messages);
      } finally {
        this.historyCaptures.delete(conversationId);
      }
    } else if (capabilities?.sessionCapabilities?.resume) {
      const result = (await this.request(
        acp.methods.agent.session.resume,
        request,
        `${this.profile.name} session resume`,
      )) as acp.ResumeSessionResponse;
      configOptions = result.configOptions;
    }
    const now = new Date().toISOString();
    const model = modelFromConfigOptions(configOptions);
    const summary: ConversationSummary = {
      id: conversationId,
      providerId: this.id,
      ...(model ? { model } : {}),
      title: `${this.profile.name} conversation`,
      preview: messages.at(-1)?.text.slice(0, 128) || '',
      status: 'idle',
      createdAt: messages[0]?.createdAt || now,
      updatedAt: messages.at(-1)?.createdAt || now,
    };
    this.sessions.set(conversationId, { cwd, summary });
    this.sessionDirectories.set(conversationId, cwd);
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
      throw new Error(`${this.profile.name} does not support image input`);
    }
    const session = this.sessions.get(conversationId);
    if (!session) throw new Error(`Unknown ${this.profile.name} conversation: ${conversationId}`);
    if (session.activeTurn) {
      throw new Error(`The current ${this.profile.name} turn has not finished`);
    }
    const turnId = `${this.profile.id}-turn-${randomUUID()}`;
    const turn: AcpTurn = {
      activities: new Map(),
      assistantMessageId: `${turnId}-message`,
      assistantText: '',
      id: turnId,
      reasoningItemId: `${turnId}-reasoning`,
    };
    session.activeTurn = turn;
    this.emit({ kind: 'turn.started', conversationId, turnId });
    const prompt = session.initialContext
      ? wrapAcpConversationContext(session.initialContext, trimmed)
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
      throw new Error(`Unknown ${this.profile.name} conversation: ${conversationId}`);
    }
    const runtime = this.runtime;
    if (!runtime) throw new Error(`${this.profile.name} ACP is unavailable`);
    await runtime.notify(acp.methods.agent.session.cancel, {
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
      throw new Error(`This ${this.profile.name} permission is no longer pending`);
    }
    if (decision === 'cancel') {
      pending.resolve({ outcome: { outcome: 'cancelled' } });
    } else {
      const optionId = pending.decisionOptions.get(decision);
      if (!optionId) {
        throw new Error(`${this.profile.name} did not offer that permission decision`);
      }
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
    this.historyCaptures.clear();
    const runtime = this.runtime;
    const closeSupported = this.initializeResponse?.agentCapabilities?.sessionCapabilities?.close;
    const sessions = [...this.sessions.entries()];
    const interruptedTurns: Array<{ conversationId: string; turnId: string }> = [];
    for (const [conversationId, session] of sessions) {
      if (!session.activeTurn) continue;
      interruptedTurns.push({ conversationId, turnId: session.activeTurn.id });
      delete session.activeTurn;
    }
    this.cancelPermissions();
    if (runtime) {
      await Promise.allSettled(
        interruptedTurns.map(({ conversationId }) =>
          runtime.notify(acp.methods.agent.session.cancel, {
            sessionId: conversationId,
          }),
        ),
      );
    }
    for (const { conversationId, turnId } of interruptedTurns) {
      this.emit({
        kind: 'turn.completed',
        conversationId,
        turnId,
        status: 'interrupted',
      });
    }
    if (runtime && closeSupported) {
      await Promise.allSettled(
        sessions.map(([conversationId]) =>
          this.requestWithRuntime(
            runtime,
            acp.methods.agent.session.close,
            { sessionId: conversationId },
            `${this.profile.name} session close`,
          ),
        ),
      );
    }
    this.sessions.clear();
    this.sessionDirectories.clear();
    this.runtime = null;
    this.runtimeStart = null;
    this.initializeResponse = null;
    this.resolution = null;
    await runtime?.close();
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
      : await this.profile.resolveExecutable({
          config,
          environment: this.options.environment,
          platform: this.options.platform,
        });
    this.resolution = resolution;
    if (!resolution.executable) {
      throw new Error(resolution.error || `${this.profile.name} CLI is unavailable`);
    }
    const runtimeReference: { value?: AcpRuntime } = {};
    const handlers: AcpRuntimeHandlers = {
      onDiagnostic: message => this.options.onDiagnostic?.(message),
      onExit: message => {
        if (runtimeReference.value) this.handleRuntimeExit(runtimeReference.value, message);
      },
      onPermission: (requestId, request) => this.handlePermissionRequest(requestId, request),
      onUpdate: notification => this.handleUpdate(notification),
    };
    const runtime = this.options.createRuntime
      ? this.options.createRuntime(resolution.executable, handlers, {
          environment: this.options.environment,
          platform: this.options.platform,
          timeoutMs: this.options.requestTimeoutMs,
        })
      : new AcpProcessRuntime(resolution.executable, handlers, {
          environment: this.options.environment,
          label: this.profile.name,
          launchArgs: this.profile.launchArgs,
          platform: this.options.platform,
          timeoutMs: this.options.requestTimeoutMs,
        });
    runtimeReference.value = runtime;
    this.runtime = runtime;
    try {
      this.initializeResponse = await runtime.start();
    } catch (error) {
      if (this.runtime === runtime) this.runtime = null;
      this.initializeResponse = null;
      await runtime.close().catch(() => {});
      throw new Error(`${this.profile.name} ACP failed to initialize: ${errorMessage(error)}`, {
        cause: error,
      });
    }
  }

  private async request(method: string, params: unknown, label: string): Promise<unknown> {
    const runtime = this.runtime;
    if (!runtime) throw new Error(`${this.profile.name} ACP is unavailable`);
    return this.requestWithRuntime(runtime, method, params, label);
  }

  private async requestWithRuntime(
    runtime: AcpRuntime,
    method: string,
    params: unknown,
    label: string,
  ): Promise<unknown> {
    let timer: NodeJS.Timeout | undefined;
    return Promise.race([
      runtime.request(method, params),
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
    session: AcpSession,
    turn: AcpTurn,
    prompt: acp.ContentBlock[],
  ): Promise<void> {
    let terminalEvent: ConversationEvent | undefined;
    try {
      const runtime = this.runtime;
      if (!runtime) throw new Error(`${this.profile.name} ACP is unavailable`);
      const result = (await runtime.request(acp.methods.agent.session.prompt, {
        sessionId: conversationId,
        prompt,
      })) as acp.PromptResponse;
      if (session.activeTurn !== turn) return;
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
      if (session.activeTurn !== turn) return;
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
      if (session.activeTurn === turn) {
        this.cancelPermissions(conversationId);
        delete session.activeTurn;
        if (terminalEvent) this.emit(terminalEvent);
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
        `Ignored ${this.profile.name} update without an active turn: ${notification.update.sessionUpdate}`,
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
        const previous = turn.activities.get(update.toolCallId);
        const status =
          update.status === undefined || update.status === null
            ? previous?.status || 'running'
            : activityStatus(update.status);
        const replacesContent = update.content !== undefined;
        const incomingText = displayableToolText(update);
        const retainedText = replacesContent ? incomingText : previous?.output;
        const detail =
          status === 'failed'
            ? replacesContent
              ? incomingText
              : previous?.detail
            : previous?.detail;
        const defaultTitle = `${this.profile.name} tool`;
        const incomingTitle = update.title?.trim();
        const incomingKind = activityKind(update);
        const activity: ConversationActivity = {
          id: update.toolCallId,
          kind:
            previous && (previous.kind !== 'tool' || !update.kind) ? previous.kind : incomingKind,
          title: bounded(
            incomingTitle && incomingTitle !== defaultTitle
              ? incomingTitle
              : previous?.title || incomingTitle || defaultTitle,
            256,
          ),
          ...(status !== 'failed' && retainedText ? { output: retainedText } : {}),
          ...(detail ? { detail } : {}),
          status,
        };
        turn.activities.set(update.toolCallId, activity);
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity,
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
            title: `${this.profile.name} plan`,
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
            : `${this.profile.name} updated its plan`;
        this.emit({
          kind: 'activity.updated',
          conversationId,
          turnId: turn.id,
          activity: {
            id: `${turn.id}-plan`,
            kind: 'other',
            title: `${this.profile.name} plan`,
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
            title: `${this.profile.name} plan`,
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
        this.options.onDiagnostic?.(`Ignored ${this.profile.name} update: ${update.sessionUpdate}`);
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
      id: update.messageId || `${this.profile.id}-history-${capture.nextId++}`,
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
    const approvalId = `${this.profile.id}:${String(requestId)}:${this.nextApprovalId++}`;
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
        title: bounded(
          request.toolCall.title || `Allow ${this.profile.name} to use this tool?`,
          256,
        ),
        description: `${this.profile.name} requested permission for a tool operation.`,
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

  private handleRuntimeExit(runtime: AcpRuntime, message: string): void {
    if (this.runtime !== runtime) return;
    this.runtime = null;
    this.initializeResponse = null;
    this.resolution = null;
    this.cancelPermissions();
    const sessions = [...this.sessions.entries()];
    this.sessions.clear();
    this.sessionDirectories.clear();
    const activeTurns: Array<{ conversationId: string; turnId: string }> = [];
    for (const [conversationId, session] of sessions) {
      if (!session.activeTurn) continue;
      activeTurns.push({ conversationId, turnId: session.activeTurn.id });
      delete session.activeTurn;
    }
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
        error: `${this.profile.name} ACP exited before the turn completed`,
      });
    }
  }

  private emit(event: ConversationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
