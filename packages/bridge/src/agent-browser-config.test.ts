import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  clearPanerelayUserDefaultProvider,
  readPanerelayProviderAvailable,
  readUserDefaultProvider,
  setPanerelayUserDefaultProvider,
  userAgentBrowserConfigPath,
} from './agent-browser-config.js';

async function fixture(): Promise<{ homeDirectory: string; cleanup: () => Promise<void> }> {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-agent-browser-config-'));
  return {
    homeDirectory,
    cleanup: () => rm(homeDirectory, { force: true, recursive: true }),
  };
}

test('sets Panerelay as default while preserving unrelated configuration', async t => {
  const { homeDirectory, cleanup } = await fixture();
  t.after(cleanup);
  const path = userAgentBrowserConfigPath(homeDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ provider: 'codex', plugins: [{ name: 'custom' }] })}\n`,
  );

  const result = await setPanerelayUserDefaultProvider({ homeDirectory });
  const config = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

  assert.equal(result.provider, 'panerelay');
  assert.equal(result.isPanerelay, true);
  assert.deepEqual(config.plugins, [{ name: 'custom' }]);
});

test('clears only a Panerelay default and keeps provider registration', async t => {
  const { homeDirectory, cleanup } = await fixture();
  t.after(cleanup);
  const path = userAgentBrowserConfigPath(homeDirectory);
  const plugins = [{ name: 'panerelay', command: '/bin/panerelay' }];
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ provider: 'panerelay', plugins })}\n`);

  const result = await clearPanerelayUserDefaultProvider({ homeDirectory });
  const config = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

  assert.equal(result.provider, null);
  assert.equal(result.isPanerelay, false);
  assert.deepEqual(config.plugins, plugins);
});

test('does not clear another default provider', async t => {
  const { homeDirectory, cleanup } = await fixture();
  t.after(cleanup);
  const path = userAgentBrowserConfigPath(homeDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ provider: 'codex' })}\n`);

  const result = await clearPanerelayUserDefaultProvider({ homeDirectory });

  assert.equal(result.provider, 'codex');
  assert.equal(result.isPanerelay, false);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { provider: 'codex' });
});

test('reads an absent user default without creating configuration', async t => {
  const { homeDirectory, cleanup } = await fixture();
  t.after(cleanup);

  const result = await readUserDefaultProvider({ homeDirectory });

  assert.equal(result.provider, null);
  assert.equal(result.isPanerelay, false);
  assert.equal(await readPanerelayProviderAvailable({ homeDirectory }), false);
});

test('recognizes only a complete Panerelay Provider registration', async t => {
  const { homeDirectory, cleanup } = await fixture();
  t.after(cleanup);
  const path = userAgentBrowserConfigPath(homeDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({
      plugins: [
        { name: 'incomplete', command: '/bin/other' },
        {
          name: 'panerelay',
          command: '/bin/panerelay',
          args: ['--agent-browser-plugin'],
          capabilities: ['browser.provider'],
        },
      ],
    })}\n`,
  );

  assert.equal(await readPanerelayProviderAvailable({ homeDirectory }), true);
});
