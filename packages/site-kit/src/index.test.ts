import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildSite,
  checkSite,
  defineCommand,
  defineSite,
  initializeSite,
  testSite,
} from './index.js';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(packageDirectory, 'dist', 'cli.js');

async function temporaryDirectory(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `panerelay-site-kit-${name}-`));
}

async function runCli(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', code =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }),
    );
  });
}

test('defineSite and defineCommand retain typed definitions', () => {
  const site = defineSite({
    id: 'example',
    name: 'Example',
    version: '1.0.0',
    description: 'Test',
  });
  const command = defineCommand({
    name: 'me',
    description: 'Profile',
    access: 'read',
    args: [],
    output: ['name'],
    examples: ['panerelay fetch example me'],
    async run() {
      return { name: 'Ada' };
    },
  });
  assert.equal(site.id, 'example');
  assert.equal(command.name, 'me');
});

test('init, check, build, and generated one-shot runtime work without project boilerplate', async () => {
  const root = await temporaryDirectory('workflow');
  const source = join(root, 'source');
  const output = join(root, 'output');
  try {
    await initializeSite(source, 'example');
    await writeFile(
      join(source, 'commands', 'me.ts'),
      `import { defineCommand } from '@panerelay/site-kit';\nexport default defineCommand({ name: 'me', description: 'Profile', access: 'read', args: [{ name: 'name', description: 'Name', type: 'string' }], output: ['name'], examples: ['panerelay fetch example me'], async run(_context, args) { return { name: args.name ?? 'Ada' }; } });\n`,
    );
    const checked = await checkSite(source);
    assert.equal(checked.manifest.id, 'example');
    assert.deepEqual((await readdir(source)).sort(), [
      'README.md',
      'commands',
      'panerelay.site.ts',
    ]);
    const built = await buildSite(source, { outDirectory: output });
    assert.deepEqual((await readdir(output)).sort(), [
      'adapter.mjs',
      'panerelay-fetch-adapter.json',
    ]);
    assert.equal(built.manifest.commands[0]?.name, 'me');

    const invocation = JSON.stringify({
      protocol: 'panerelay.fetch-adapter.v1',
      requestId: 'request-1',
      operation: 'execute',
      command: 'me',
      args: { name: 'Grace' },
      fetch: {
        endpoint: 'http://127.0.0.1:41234/fetch',
        token: 'fetch-session-secret-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    const response = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [join(output, 'adapter.mjs')], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
      child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
        else reject(new Error(Buffer.concat(stderr).toString('utf8')));
      });
      child.stdin.end(invocation);
    });
    assert.deepEqual(JSON.parse(response), {
      protocol: 'panerelay.fetch-adapter.v1',
      requestId: 'request-1',
      operation: 'execute',
      success: true,
      result: { name: 'Grace' },
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('build is deterministic and refuses unrelated output', async () => {
  const root = await temporaryDirectory('deterministic');
  const source = join(root, 'source');
  const first = join(root, 'first');
  const second = join(root, 'second');
  try {
    await initializeSite(source, 'example');
    await buildSite(source, { outDirectory: first });
    await buildSite(source, { outDirectory: second });
    assert.equal(
      await readFile(join(first, 'adapter.mjs'), 'utf8'),
      await readFile(join(second, 'adapter.mjs'), 'utf8'),
    );
    await writeFile(join(first, 'unrelated.txt'), 'keep');
    await assert.rejects(buildSite(source, { outDirectory: first }), /not empty|owned/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('check rejects computed metadata and unsupported package imports without source execution', async () => {
  const root = await temporaryDirectory('static');
  const source = join(root, 'source');
  const marker = join(root, 'executed');
  try {
    await initializeSite(source, 'example');
    await writeFile(
      join(source, 'commands', 'me.ts'),
      `import { writeFileSync } from 'node:fs';\nimport { defineCommand } from '@panerelay/site-kit';\nwriteFileSync(${JSON.stringify(marker)}, 'bad');\nconst name = 'me';\nexport default defineCommand({ name, description: 'Profile', access: 'read', args: [], output: ['name'], examples: ['example'], async run() { return {}; } });\n`,
    );
    await assert.rejects(checkSite(source), /spreads|statically evaluable/);
    await assert.rejects(readFile(marker), /ENOENT/);
    await writeFile(
      join(source, 'commands', 'me.ts'),
      `import leftPad from 'left-pad';\nimport { defineCommand } from '@panerelay/site-kit';\nexport default defineCommand({ name: 'me', description: 'Profile', access: 'read', args: [], output: ['name'], examples: ['example'], async run() { return leftPad('x', 2); } });\n`,
    );
    await assert.rejects(checkSite(source), /unsupported package import: left-pad/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('test operation runs only explicit colocated tests', async () => {
  const root = await temporaryDirectory('tests');
  const source = join(root, 'source');
  try {
    await initializeSite(source, 'example');
    await writeFile(
      join(source, 'commands', 'me.test.ts'),
      `import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('site fixture', () => assert.equal(2 + 2, 4));\n`,
    );
    const result = await testSite(source);
    assert.deepEqual(result.testFiles, ['commands/me.test.ts']);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('CLI exposes package-runner help, version, success, and failure exit codes', async () => {
  const help = await runCli(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /panerelay-site init/);
  const version = await runCli(['--version']);
  assert.equal(version.code, 0);
  assert.match(version.stdout, /^v0\.8\.0\n$/);
  const invalid = await runCli(['unknown']);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /unknown command/);
});
