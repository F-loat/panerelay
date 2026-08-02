import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { resolveSpawnCommand } from './platform.js';

const MAX_STREAM_LINE_BYTES = 1024 * 1024;
const MAX_STDERR_CHARS = 8 * 1024;
const MAX_TRANSCRIPT_LINE_CHARS = 1024 * 1024;
const MAX_TRANSCRIPT_SCAN_BYTES = 32 * 1024 * 1024;
const MAX_PROJECT_DIRECTORIES = 256;
const MAX_SESSION_CANDIDATES = 256;
const MAX_SESSION_MESSAGES = 1_000;
const TERMINATION_GRACE_MS = 2_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClaudeMcpServer =
  | {
      alwaysLoad?: boolean;
      args?: string[];
      command: string;
      env?: Record<string, string>;
      type?: 'stdio';
    }
  | {
      alwaysLoad?: boolean;
      headers?: Record<string, string>;
      type: 'http';
      url: string;
    };

export interface ClaudeCliUserMessage {
  message: {
    content: Array<
      | { text: string; type: 'text' }
      | {
          source: {
            data: string;
            media_type: 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';
            type: 'base64';
          };
          type: 'image';
        }
    >;
    role: 'user';
  };
  parent_tool_use_id: null;
  session_id: '';
  type: 'user';
}

export type ClaudeCliMessage = Record<string, unknown>;

export interface ClaudeSessionInfo {
  createdAt?: number;
  customTitle?: string;
  cwd?: string;
  firstPrompt?: string;
  lastModified: number;
  sessionId: string;
  summary?: string;
}

export interface ClaudeSessionMessage {
  message: unknown;
  parent_tool_use_id: string | null;
  session_id: string;
  timestamp?: string;
  type: 'assistant' | 'user';
  uuid: string;
}

export interface ClaudeCliQueryParameters {
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  executable: string;
  mcpServers?: Record<string, ClaudeMcpServer>;
  permissionPromptTool: string;
  platform?: NodeJS.Platform;
  prompt: ClaudeCliUserMessage;
  resume?: string;
  sessionId?: string;
  systemPrompt?: string;
}

export interface ClaudeCliQuery extends AsyncIterable<ClaudeCliMessage> {
  close(): void;
  interrupt(): Promise<void>;
}

export interface ClaudeCli {
  getSessionInfo(
    sessionId: string,
    options?: { dir?: string },
  ): Promise<ClaudeSessionInfo | undefined>;
  getSessionMessages(
    sessionId: string,
    options?: { dir?: string; limit?: number },
  ): Promise<ClaudeSessionMessage[]>;
  listSessions(options?: { dir?: string; limit?: number }): Promise<ClaudeSessionInfo[]>;
  query(parameters: ClaudeCliQueryParameters): ClaudeCliQuery;
}

export type ClaudeCliSpawner = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export interface ClaudeCliOptions {
  configDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  spawner?: ClaudeCliSpawner;
}

class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<{
    reject: (error: Error) => void;
    resolve: (result: IteratorResult<T>) => void;
  }> = [];
  private ended = false;
  private failure: Error | undefined;

  push(value: T): void {
    if (this.ended || this.failure) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ done: false, value });
    else this.values.push(value);
  }

  close(): void {
    if (this.ended || this.failure) return;
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ done: true, value: undefined });
  }

  fail(error: Error): void {
    if (this.ended || this.failure) return;
    this.failure = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) return Promise.resolve({ done: false, value });
        if (this.failure) return Promise.reject(this.failure);
        if (this.ended) return Promise.resolve({ done: true, value: undefined });
        return new Promise<IteratorResult<T>>((resolveResult, reject) => {
          this.waiters.push({ reject, resolve: resolveResult });
        });
      },
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function diagnostic(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 2_048);
}

function writeRecord(child: ChildProcessWithoutNullStreams, record: object): Promise<void> {
  if (child.stdin.destroyed || !child.stdin.writable) {
    return Promise.reject(new Error('Claude Code input is closed'));
  }
  return new Promise((resolveWrite, reject) => {
    child.stdin.write(`${JSON.stringify(record)}\n`, error => {
      if (error) reject(error);
      else resolveWrite();
    });
  });
}

class SpawnedClaudeQuery implements ClaudeCliQuery {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly queue = new AsyncQueue<ClaudeCliMessage>();
  private stderr = '';
  private exited = false;
  private exitCode: number | null = null;
  private failed = false;
  private sawResult = false;
  private stdoutEnded = false;
  private terminationTimer: NodeJS.Timeout | undefined;

  constructor(
    parameters: ClaudeCliQueryParameters,
    spawner: ClaudeCliSpawner,
    defaultEnvironment: NodeJS.ProcessEnv,
    defaultPlatform: NodeJS.Platform,
  ) {
    const environment: NodeJS.ProcessEnv = {
      ...defaultEnvironment,
      ...parameters.environment,
      CLAUDE_CODE_ENTRYPOINT: 'panerelay',
    };
    const platform = parameters.platform ?? defaultPlatform;
    const args = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--input-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-prompt-tool',
      parameters.permissionPromptTool,
      '--permission-mode',
      'default',
      '--settings',
      JSON.stringify({
        permissions: {
          ask: [
            'Agent',
            'Bash',
            'CronCreate',
            'CronDelete',
            'Edit',
            'Monitor',
            'MultiEdit',
            'NotebookEdit',
            'PowerShell',
            'Task',
            'WebFetch',
            'Write',
          ],
          disableBypassPermissionsMode: 'disable',
        },
        sandbox: { autoAllowBashIfSandboxed: false },
      }),
      '--setting-sources=user,project,local',
      ...(parameters.systemPrompt ? ['--append-system-prompt', parameters.systemPrompt] : []),
      ...(parameters.resume
        ? [`--resume=${parameters.resume}`]
        : parameters.sessionId
          ? [`--session-id=${parameters.sessionId}`]
          : []),
      ...(parameters.mcpServers && Object.keys(parameters.mcpServers).length > 0
        ? ['--mcp-config', JSON.stringify({ mcpServers: parameters.mcpServers })]
        : []),
    ];
    const launch = resolveSpawnCommand(parameters.executable, args, platform, environment.ComSpec);
    this.child = spawner(launch.command, launch.args, {
      cwd: parameters.cwd,
      env: environment,
      windowsHide: true,
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
    });
    this.readStdout();
    this.readStderr();
    this.child.stdin.on('error', error => {
      if (!this.sawResult && !this.exited) {
        this.fail(new Error(`Claude Code input failed: ${error.message}`));
      }
    });
    this.child.once('error', error =>
      this.fail(new Error(`Claude Code failed to start: ${error.message}`)),
    );
    this.child.once('exit', code => {
      this.exited = true;
      this.exitCode = code;
      this.finishIfReady();
    });

    void writeRecord(this.child, parameters.prompt).catch(error =>
      this.fail(
        new Error(
          `Claude Code input failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ),
    );
  }

  private readStdout(): void {
    const decoder = new StringDecoder('utf8');
    let buffered = '';
    const parseBuffered = (final: boolean): void => {
      while (!this.failed) {
        const newline = buffered.indexOf('\n');
        if (newline < 0) break;
        const line = buffered.slice(0, newline).replace(/\r$/, '');
        buffered = buffered.slice(newline + 1);
        this.handleLine(line);
      }
      if (!this.failed && Buffer.byteLength(buffered, 'utf8') > MAX_STREAM_LINE_BYTES) {
        this.fail(new Error('Claude Code emitted an over-limit stream record'));
      }
      if (final && buffered.trim() && !this.failed) this.handleLine(buffered.replace(/\r$/, ''));
    };
    this.child.stdout.on('data', chunk => {
      buffered += decoder.write(chunk as Buffer);
      parseBuffered(false);
    });
    this.child.stdout.once('end', () => {
      buffered += decoder.end();
      parseBuffered(true);
      this.stdoutEnded = true;
      this.finishIfReady();
    });
    this.child.stdout.once('error', error =>
      this.fail(new Error(`Claude Code output failed: ${error.message}`)),
    );
  }

  private readStderr(): void {
    this.child.stderr.on('data', chunk => {
      if (this.stderr.length >= MAX_STDERR_CHARS) return;
      this.stderr = `${this.stderr}${(chunk as Buffer).toString('utf8')}`.slice(
        0,
        MAX_STDERR_CHARS,
      );
    });
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    if (Buffer.byteLength(line, 'utf8') > MAX_STREAM_LINE_BYTES) {
      this.fail(new Error('Claude Code emitted an over-limit stream record'));
      return;
    }
    let message: ClaudeCliMessage;
    try {
      message = asRecord(JSON.parse(line));
    } catch {
      this.fail(new Error('Claude Code emitted malformed stream JSON'));
      return;
    }
    if (typeof message.type !== 'string') {
      this.fail(new Error('Claude Code emitted an invalid stream record'));
      return;
    }
    if (message.type === 'keep_alive') return;
    if (message.type === 'result') {
      this.sawResult = true;
      this.child.stdin.end();
    }
    this.queue.push(message);
  }

  private finishIfReady(): void {
    if (this.failed || !this.exited || !this.stdoutEnded) return;
    if (this.terminationTimer) clearTimeout(this.terminationTimer);
    if (this.exitCode !== 0) {
      const detail = diagnostic(this.stderr);
      this.queue.fail(
        new Error(
          `Claude Code exited with code ${this.exitCode ?? 1}${detail ? `: ${detail}` : ''}`,
        ),
      );
      return;
    }
    if (!this.sawResult) {
      this.queue.fail(new Error('Claude Code exited without a terminal result'));
      return;
    }
    this.queue.close();
  }

  private fail(error: Error): void {
    if (this.failed) return;
    this.failed = true;
    this.queue.fail(error);
    this.terminate();
  }

  private terminate(): void {
    if (!this.child.stdin.destroyed) this.child.stdin.end();
    if (!this.exited) this.child.kill('SIGTERM');
    if (this.terminationTimer) clearTimeout(this.terminationTimer);
    this.terminationTimer = setTimeout(() => {
      if (!this.exited) this.child.kill('SIGKILL');
    }, TERMINATION_GRACE_MS);
    this.terminationTimer.unref();
  }

  async interrupt(): Promise<void> {
    if (this.exited || this.failed) return;
    this.terminate();
  }

  close(): void {
    this.terminate();
  }

  [Symbol.asyncIterator](): AsyncIterator<ClaudeCliMessage> {
    return this.queue[Symbol.asyncIterator]();
  }
}

function validSessionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function projectDirectoryName(directory: string): string {
  return directory.replace(/[^A-Za-z0-9_-]/g, '-');
}

async function canonicalDirectory(directory: string): Promise<string> {
  try {
    return await realpath(directory);
  } catch {
    return resolve(directory);
  }
}

function projectsRoot(options: ClaudeCliOptions): string {
  return join(
    options.configDirectory ??
      options.environment?.CLAUDE_CONFIG_DIR ??
      join(options.homeDirectory ?? homedir(), '.claude'),
    'projects',
  );
}

async function candidateProjectDirectories(
  options: ClaudeCliOptions,
  directory?: string,
): Promise<string[]> {
  const root = projectsRoot(options);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const directories = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  if (!directory) {
    return directories.slice(0, MAX_PROJECT_DIRECTORIES).map(name => join(root, name));
  }
  const canonical = await canonicalDirectory(directory);
  const key = projectDirectoryName(canonical);
  return directories
    .filter(name => name === key || name.startsWith(`${key}--claude-worktrees-`))
    .slice(0, MAX_PROJECT_DIRECTORIES)
    .map(name => join(root, name));
}

async function transcriptCandidates(
  options: ClaudeCliOptions,
  directory?: string,
): Promise<Array<{ filePath: string; modifiedAt: number; sessionId: string }>> {
  const candidates: Array<{ filePath: string; modifiedAt: number; sessionId: string }> = [];
  for (const projectDirectory of await candidateProjectDirectories(options, directory)) {
    let entries;
    try {
      entries = await readdir(projectDirectory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const sessionId = basename(entry.name, '.jsonl');
      if (!validSessionId(sessionId)) continue;
      const filePath = join(projectDirectory, entry.name);
      try {
        const metadata = await stat(filePath);
        candidates.push({ filePath, modifiedAt: metadata.mtimeMs, sessionId });
      } catch {
        // A transcript removed during enumeration is simply absent.
      }
    }
  }
  return candidates
    .sort(
      (left, right) =>
        right.modifiedAt - left.modifiedAt || left.sessionId.localeCompare(right.sessionId),
    )
    .slice(0, MAX_SESSION_CANDIDATES);
}

async function transcriptPath(
  options: ClaudeCliOptions,
  sessionId: string,
  directory?: string,
): Promise<string | undefined> {
  if (!validSessionId(sessionId)) return undefined;
  for (const projectDirectory of await candidateProjectDirectories(options, directory)) {
    const filePath = join(projectDirectory, `${sessionId}.jsonl`);
    try {
      const metadata = await stat(filePath);
      if (metadata.isFile()) return filePath;
    } catch {
      // Continue to another project directory.
    }
  }
  return undefined;
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(block => asRecord(block))
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('\n');
}

async function scanTranscript(
  filePath: string,
  onRecord: (record: Record<string, unknown>) => void,
): Promise<void> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let scannedBytes = 0;
  try {
    for await (const line of lines) {
      scannedBytes += Buffer.byteLength(line, 'utf8') + 1;
      if (scannedBytes > MAX_TRANSCRIPT_SCAN_BYTES) break;
      if (!line || line.length > MAX_TRANSCRIPT_LINE_CHARS) continue;
      try {
        onRecord(asRecord(JSON.parse(line)));
      } catch {
        // Transcript history is optional; malformed records are skipped.
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

async function readSessionInfo(
  filePath: string,
  sessionId: string,
  modifiedAt?: number,
): Promise<ClaudeSessionInfo | undefined> {
  let createdAt: number | undefined;
  let cwd: string | undefined;
  let customTitle: string | undefined;
  let firstPrompt: string | undefined;
  let latestPrompt: string | undefined;
  let summary: string | undefined;
  await scanTranscript(filePath, record => {
    if (record.sessionId !== sessionId) return;
    if (!cwd && typeof record.cwd === 'string') cwd = record.cwd;
    if (typeof record.customTitle === 'string' && record.customTitle.trim()) {
      customTitle = record.customTitle.trim();
    }
    if (typeof record.aiTitle === 'string' && record.aiTitle.trim()) {
      summary = record.aiTitle.trim();
    }
    if (typeof record.summary === 'string' && record.summary.trim()) {
      summary = record.summary.trim();
    }
    if (typeof record.timestamp === 'string') {
      const parsed = Date.parse(record.timestamp);
      if (Number.isFinite(parsed) && (createdAt === undefined || parsed < createdAt)) {
        createdAt = parsed;
      }
    }
    if (record.type !== 'user' || record.isSidechain === true || record.isMeta === true) return;
    const text = textFromContent(asRecord(record.message).content).trim();
    if (!text) return;
    firstPrompt ??= text;
    latestPrompt = text;
  });
  if (!cwd && !firstPrompt && !customTitle && !summary) return undefined;
  return {
    sessionId,
    lastModified: modifiedAt ?? (await stat(filePath)).mtimeMs,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(cwd ? { cwd } : {}),
    ...(customTitle ? { customTitle } : {}),
    ...(firstPrompt ? { firstPrompt } : {}),
    ...(summary || latestPrompt || firstPrompt
      ? { summary: summary || latestPrompt || firstPrompt }
      : {}),
  };
}

async function readSessionMessages(
  filePath: string,
  sessionId: string,
  limit: number,
): Promise<ClaudeSessionMessage[]> {
  const messages: ClaudeSessionMessage[] = [];
  await scanTranscript(filePath, record => {
    if (record.sessionId !== sessionId) return;
    if (record.type !== 'user' && record.type !== 'assistant') return;
    if (record.isSidechain === true || record.isMeta === true || record.teamName) return;
    if (typeof record.uuid !== 'string') return;
    messages.push({
      type: record.type,
      uuid: record.uuid,
      session_id: sessionId,
      parent_tool_use_id:
        typeof record.parent_tool_use_id === 'string'
          ? record.parent_tool_use_id
          : typeof record.parentToolUseId === 'string'
            ? record.parentToolUseId
            : null,
      message: record.message,
      ...(typeof record.timestamp === 'string' ? { timestamp: record.timestamp } : {}),
    });
    if (messages.length > limit) messages.shift();
  });
  return messages;
}

export function createClaudeCli(options: ClaudeCliOptions = {}): ClaudeCli {
  const spawner: ClaudeCliSpawner =
    options.spawner ??
    ((command, args, spawnOptions) =>
      spawn(command, args, {
        ...spawnOptions,
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
  return {
    async listSessions(listOptions = {}) {
      const candidates = await transcriptCandidates(options, listOptions.dir);
      const sessions: ClaudeSessionInfo[] = [];
      for (const candidate of candidates) {
        const info = await readSessionInfo(
          candidate.filePath,
          candidate.sessionId,
          candidate.modifiedAt,
        );
        if (info) sessions.push(info);
        if (sessions.length >= (listOptions.limit ?? 30)) break;
      }
      return sessions;
    },
    async getSessionInfo(sessionId, infoOptions = {}) {
      const filePath = await transcriptPath(options, sessionId, infoOptions.dir);
      return filePath ? readSessionInfo(filePath, sessionId) : undefined;
    },
    async getSessionMessages(sessionId, messageOptions = {}) {
      const filePath = await transcriptPath(options, sessionId, messageOptions.dir);
      return filePath
        ? readSessionMessages(
            filePath,
            sessionId,
            Math.min(
              Math.max(messageOptions.limit ?? MAX_SESSION_MESSAGES, 1),
              MAX_SESSION_MESSAGES,
            ),
          )
        : [];
    },
    query(parameters) {
      return new SpawnedClaudeQuery(
        parameters,
        spawner,
        options.environment ?? process.env,
        options.platform ?? process.platform,
      );
    },
  };
}
