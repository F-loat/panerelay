import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  configureGlobalProvider,
  configureProjectProvider,
  projectAgentBrowserConfigPath,
  registerPanerelayProvider,
  removeProjectProvider,
  unregisterPanerelayProvider,
  userAgentBrowserConfigPath,
} from './config.js';

test('registers Panerelay without replacing unrelated user configuration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-config-'));
  const homeDirectory = join(root, 'home');
  const path = userAgentBrowserConfigPath(homeDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({
      provider: 'existing',
      plugins: [{ name: 'other', command: '/other' }],
      session: 'kept',
    })}\n`,
  );

  try {
    await registerPanerelayProvider('/panerelay/host', { homeDirectory });
    let config = JSON.parse(await readFile(path, 'utf8')) as {
      plugins: Array<{ command: string; name: string }>;
      provider: string;
      session: string;
    };
    assert.equal(config.provider, 'existing');
    assert.equal(config.session, 'kept');
    assert.deepEqual(
      config.plugins.map(plugin => plugin.name),
      ['other', 'panerelay'],
    );

    await configureGlobalProvider({ homeDirectory });
    config = JSON.parse(await readFile(path, 'utf8')) as typeof config;
    assert.equal(config.provider, 'panerelay');

    await unregisterPanerelayProvider({ homeDirectory });
    config = JSON.parse(await readFile(path, 'utf8')) as typeof config;
    assert.equal(config.provider, undefined);
    assert.equal(config.session, 'kept');
    assert.deepEqual(config.plugins, [{ name: 'other', command: '/other' }]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('sets and removes the project default without disturbing other keys', async () => {
  const projectDirectory = await mkdtemp(join(tmpdir(), 'panerelay-project-'));
  const path = projectAgentBrowserConfigPath(projectDirectory);
  await writeFile(path, `${JSON.stringify({ session: 'project-session' })}\n`);

  try {
    await configureProjectProvider({ projectDirectory });
    let config = JSON.parse(await readFile(path, 'utf8')) as {
      provider?: string;
      session: string;
    };
    assert.deepEqual(config, { session: 'project-session', provider: 'panerelay' });

    await removeProjectProvider({ projectDirectory });
    config = JSON.parse(await readFile(path, 'utf8')) as typeof config;
    assert.deepEqual(config, { session: 'project-session' });
  } finally {
    await rm(projectDirectory, { force: true, recursive: true });
  }
});
