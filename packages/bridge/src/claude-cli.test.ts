import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  createClaudeCli,
  type ClaudeCliMessage,
  type ClaudeCliQuery,
  type ClaudeCliQueryParameters,
  type ClaudeCliSpawner,
} from './claude-cli.js';

class FakeChildProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly signals: Array<NodeJS.Signals | number | undefined> = [];

  kill(signal?: NodeJS.Signals | number): boolean {
    this.signals.push(signal);
    return true;
  }
}

function userPrompt(text: string): ClaudeCliQueryParameters['prompt'] {
  return {
    type: 'user',
    session_id: '',
    message: { role: 'user', content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
  };
}

function fakeSpawn() {
  const children: FakeChildProcess[] = [];
  const launches: Array<{
    args: string[];
    command: string;
    options: Parameters<ClaudeCliSpawner>[2];
  }> = [];
  const spawner: ClaudeCliSpawner = (command, args, options) => {
    const child = new FakeChildProcess();
    children.push(child);
    launches.push({ args, command, options });
    return child as unknown as ChildProcessWithoutNullStreams;
  };
  return { children, launches, spawner };
}

async function nextTask(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
}

async function collect(query: ClaudeCliQuery): Promise<ClaudeCliMessage[]> {
  const messages: ClaudeCliMessage[] = [];
  for await (const message of query) messages.push(message);
  return messages;
}

test('uses the Claude stream-json protocol without putting the prompt in process arguments', async () => {
  const spawned = fakeSpawn();
  const cli = createClaudeCli({
    environment: { PATH: '/usr/local/bin' },
    platform: 'linux',
    spawner: spawned.spawner,
  });
  const query = cli.query({
    executable: '/usr/local/bin/claude',
    cwd: '/workspace/repo',
    prompt: userPrompt('secret prompt'),
    permissionPromptTool: 'mcp__panerelay_permission__approve',
    sessionId: '11111111-1111-4111-8111-111111111111',
    systemPrompt: 'Panerelay context',
    mcpServers: {
      user_browser: {
        type: 'stdio',
        command: '/usr/local/bin/user-browser-tool',
        args: ['mcp'],
      },
      panerelay_permission: {
        type: 'http',
        url: 'http://127.0.0.1:54321/random/mcp',
        alwaysLoad: true,
      },
    },
  });
  const child = spawned.children[0]!;
  let input = '';
  child.stdin.on('data', chunk => {
    input += (chunk as Buffer).toString('utf8');
  });
  await nextTask();

  assert.equal(spawned.launches[0]?.command, '/usr/local/bin/claude');
  assert.deepEqual(spawned.launches[0]?.options.cwd, '/workspace/repo');
  assert.equal(spawned.launches[0]?.options.env?.CLAUDE_CODE_ENTRYPOINT, 'panerelay');
  const processArguments = JSON.stringify(spawned.launches[0]?.args);
  assert.match(processArguments, /stream-json/);
  assert.match(processArguments, /permission-prompt-tool/);
  assert.match(processArguments, /mcp__panerelay_permission__approve/);
  assert.doesNotMatch(processArguments, /strict-mcp-config|mcp__panerelay_browser/);
  assert.match(processArguments, /11111111-1111-4111-8111-111111111111/);
  assert.match(processArguments, /user_browser/);
  assert.match(processArguments, /panerelay_permission/);
  assert.match(processArguments, /Panerelay context/);
  assert.doesNotMatch(processArguments, /secret prompt/);

  const inputRecords = input
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Record<string, unknown>);
  assert.equal(inputRecords.length, 1);
  assert.equal(inputRecords[0]?.type, 'user');
  assert.match(JSON.stringify(inputRecords[0]), /secret prompt/);

  const result = collect(query);
  child.stdout.write('{"type":"assistant","uuid":"assistant-1",');
  child.stdout.write(
    '"message":{"role":"assistant","content":[{"type":"text","text":"Ready"}]}}\n',
  );
  child.stdout.end(
    '{"type":"result","subtype":"success","usage":{"input_tokens":1,"output_tokens":1}}\n',
  );
  child.emit('exit', 0);
  assert.deepEqual(
    (await result).map(message => message.type),
    ['assistant', 'result'],
  );
});

test('fails closed and terminates Claude when stream output is malformed', async () => {
  const spawned = fakeSpawn();
  const cli = createClaudeCli({ platform: 'linux', spawner: spawned.spawner });
  const query = cli.query({
    executable: '/usr/local/bin/claude',
    cwd: '/workspace/repo',
    permissionPromptTool: 'mcp__panerelay_permission__approve',
    prompt: userPrompt('hello'),
  });
  const child = spawned.children[0]!;
  const result = collect(query);
  child.stdout.write('not-json\n');

  await assert.rejects(result, /malformed stream JSON/);
  assert.deepEqual(child.signals, ['SIGTERM']);
  child.emit('exit', 1);
  child.stdout.end();
});

test('fails the query instead of crashing when Claude closes stdin', async () => {
  const spawned = fakeSpawn();
  const cli = createClaudeCli({ platform: 'linux', spawner: spawned.spawner });
  const query = cli.query({
    executable: '/usr/local/bin/claude',
    cwd: '/workspace/repo',
    permissionPromptTool: 'mcp__panerelay_permission__approve',
    prompt: userPrompt('hello'),
  });
  const child = spawned.children[0]!;
  const result = collect(query);
  child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));

  await assert.rejects(result, /Claude Code input failed: write EPIPE/);
  assert.deepEqual(child.signals, ['SIGTERM']);
  child.emit('exit', 1);
  child.stdout.end();
});

test('uses the existing Windows command-wrapper escaping for a global claude.cmd', () => {
  const spawned = fakeSpawn();
  const cli = createClaudeCli({
    environment: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    platform: 'win32',
    spawner: spawned.spawner,
  });
  const query = cli.query({
    executable: 'C:\\Program Files\\nodejs\\claude.cmd',
    cwd: 'C:\\workspace\\repo',
    permissionPromptTool: 'mcp__panerelay_permission__approve',
    prompt: userPrompt('hello'),
  });

  assert.equal(spawned.launches[0]?.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(spawned.launches[0]?.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(spawned.launches[0]?.options.windowsVerbatimArguments, true);
  query.close();
  spawned.children[0]!.emit('exit', 0);
  spawned.children[0]!.stdout.end();
});

test('reads cwd-scoped top-level Claude transcripts with bounded history', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-claude-cli-'));
  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  const cwd = join(root, 'workspace');
  await mkdir(cwd);
  const canonicalCwd = await realpath(cwd);
  const projectDirectory = join(
    root,
    'config',
    'projects',
    canonicalCwd.replace(/[^A-Za-z0-9_-]/g, '-'),
  );
  await mkdir(projectDirectory, { recursive: true });
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const records = [
    {
      type: 'user',
      uuid: 'user-1',
      sessionId,
      cwd: canonicalCwd,
      timestamp: '2026-01-01T00:00:00.000Z',
      message: { role: 'user', content: 'Inspect the app' },
    },
    {
      type: 'assistant',
      uuid: 'assistant-1',
      sessionId,
      cwd: canonicalCwd,
      timestamp: '2026-01-01T00:00:01.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Ready.' }] },
    },
    {
      type: 'assistant',
      uuid: 'sidechain-1',
      sessionId,
      cwd: canonicalCwd,
      isSidechain: true,
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hidden.' }] },
    },
    { type: 'summary', sessionId, summary: 'App inspection' },
  ];
  await writeFile(
    join(projectDirectory, `${sessionId}.jsonl`),
    `${records.map(record => JSON.stringify(record)).join('\n')}\n`,
  );

  const cli = createClaudeCli({ configDirectory: join(root, 'config') });
  const sessions = await cli.listSessions({ dir: cwd });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.sessionId, sessionId);
  assert.equal(sessions[0]?.firstPrompt, 'Inspect the app');
  assert.equal(sessions[0]?.summary, 'App inspection');
  assert.equal((await cli.getSessionInfo(sessionId, { dir: cwd }))?.cwd, canonicalCwd);
  assert.deepEqual(
    (await cli.getSessionMessages(sessionId, { dir: cwd })).map(message => message.uuid),
    ['user-1', 'assistant-1'],
  );
  assert.equal(await cli.getSessionInfo('../../etc/passwd', { dir: cwd }), undefined);
});

test('filters cwd projects before applying the project-directory scan bound', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-claude-project-bound-'));
  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  const cwd = join(root, 'workspace');
  await mkdir(cwd);
  const canonicalCwd = await realpath(cwd);
  const projects = join(root, 'config', 'projects');
  await mkdir(projects, { recursive: true });
  await Promise.all(
    Array.from({ length: 300 }, (_, index) =>
      mkdir(join(projects, `!unrelated-${String(index).padStart(3, '0')}`)),
    ),
  );
  const projectDirectory = join(projects, canonicalCwd.replace(/[^A-Za-z0-9_-]/g, '-'));
  await mkdir(projectDirectory);
  const sessionId = '22222222-2222-4222-8222-222222222222';
  await writeFile(
    join(projectDirectory, `${sessionId}.jsonl`),
    `${JSON.stringify({
      type: 'user',
      uuid: 'user-bound',
      sessionId,
      cwd: canonicalCwd,
      message: { role: 'user', content: 'Found after the global bound' },
    })}\n`,
  );

  const cli = createClaudeCli({ configDirectory: join(root, 'config') });
  assert.equal((await cli.listSessions({ dir: cwd }))[0]?.sessionId, sessionId);
});
