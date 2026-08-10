import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  installClaudeFetchIntegration,
  installCodexFetchIntegration,
  readAgentFetchIntegrationStatus,
  uninstallClaudeFetchIntegration,
  uninstallCodexFetchIntegration,
} from './agent-fetch-integration.js';

test('installs, updates, diagnoses, and removes only managed Codex configuration', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-codex-fetch-'));
  const configPath = join(homeDirectory, '.codex', 'config.toml');
  await installCodexFetchIntegration('/first host', { homeDirectory });
  let source = await readFile(configPath, 'utf8');
  assert.match(source, /tools/);
  assert.match(source, /web_search = false/);
  assert.match(source, /command = "\/first host"/);
  await installCodexFetchIntegration('/second host', { homeDirectory });
  source = await readFile(configPath, 'utf8');
  assert.match(source, /second host/);
  assert.doesNotMatch(source, /first host/);
  assert.equal(
    (await readAgentFetchIntegrationStatus('codex', { homeDirectory })).configured,
    true,
  );
  await uninstallCodexFetchIntegration({ homeDirectory });
  await assert.rejects(readFile(configPath, 'utf8'), { code: 'ENOENT' });
});

test('restores an existing Codex WebSearch value and rejects unmanaged MCP conflicts', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-codex-existing-'));
  const directory = join(homeDirectory, '.codex');
  const configPath = join(directory, 'config.toml');
  await installCodexFetchIntegration('/host', { homeDirectory });
  await uninstallCodexFetchIntegration({ homeDirectory });
  await writeFile(configPath, '[tools]\nweb_search = true # user value\n\n[model]\nname = "x"\n');
  await installCodexFetchIntegration('/host', { homeDirectory });
  await uninstallCodexFetchIntegration({ homeDirectory });
  assert.match(await readFile(configPath, 'utf8'), /web_search = true # user value/);

  await writeFile(configPath, '[mcp_servers.panerelay_fetch]\ncommand = "user"\n');
  await assert.rejects(installCodexFetchIntegration('/host', { homeDirectory }), /unmanaged/);
});

test('preserves existing user-owned Agent config and directory permissions', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-agent-fetch-mode-'));
  const codexDirectory = join(homeDirectory, '.codex');
  const configPath = join(codexDirectory, 'config.toml');
  await mkdir(codexDirectory, { mode: 0o755 });
  await writeFile(configPath, '[model]\nname = "x"\n', { mode: 0o644 });
  await chmod(codexDirectory, 0o755);
  await chmod(configPath, 0o644);
  await installCodexFetchIntegration('/host', { homeDirectory });
  assert.equal((await stat(codexDirectory)).mode & 0o777, 0o755);
  assert.equal((await stat(configPath)).mode & 0o777, 0o644);
});

test('refuses to remove modified Panerelay-owned Codex configuration', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-codex-modified-'));
  const configPath = join(homeDirectory, '.codex', 'config.toml');
  await installCodexFetchIntegration('/host', { homeDirectory });
  const source = await readFile(configPath, 'utf8');
  await writeFile(configPath, source.replace('command = "/host"', 'command = "/changed"'));
  await assert.rejects(uninstallCodexFetchIntegration({ homeDirectory }), /modified/);
  assert.match(await readFile(configPath, 'utf8'), /command = "\/changed"/);
});

test('preserves unrelated Claude JSON and removes only Panerelay-owned fields', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-claude-fetch-'));
  const configPath = join(homeDirectory, '.claude.json');
  const settingsPath = join(homeDirectory, '.claude', 'settings.json');
  await writeFile(configPath, '{"theme":"dark","mcpServers":{"user":{"command":"user"}}}\n');
  await installClaudeFetchIntegration('/host', { homeDirectory });
  const configured = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
  assert.equal(configured.theme, 'dark');
  assert.deepEqual((configured.mcpServers as Record<string, unknown>).panerelay_fetch, {
    type: 'stdio',
    command: '/host',
    args: ['--fetch-mcp'],
  });
  assert.equal(
    (await readAgentFetchIntegrationStatus('claude', { homeDirectory })).configured,
    true,
  );
  await uninstallClaudeFetchIntegration({ homeDirectory });
  const restored = JSON.parse(await readFile(configPath, 'utf8')) as {
    mcpServers: Record<string, unknown>;
    theme: string;
  };
  assert.equal(restored.theme, 'dark');
  assert.deepEqual(restored.mcpServers, { user: { command: 'user' } });
  await assert.rejects(readFile(settingsPath, 'utf8'), { code: 'ENOENT' });
});

test('refuses to remove a modified Panerelay-owned Claude WebFetch policy', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-claude-modified-'));
  const configPath = join(homeDirectory, '.claude.json');
  const settingsPath = join(homeDirectory, '.claude', 'settings.json');
  await installClaudeFetchIntegration('/host', { homeDirectory });
  await writeFile(settingsPath, '{"permissions":{"deny":[]}}\n');
  await assert.rejects(uninstallClaudeFetchIntegration({ homeDirectory }), /modified/);
  const configured = JSON.parse(await readFile(configPath, 'utf8')) as {
    mcpServers: Record<string, unknown>;
  };
  assert.ok(configured.mcpServers.panerelay_fetch);
});
