import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_PLAYWRIGHT_GATEWAY_URL } from '@panerelay/playwright';
import {
  installPlaywrightIntegration,
  PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
  uninstallPlaywrightIntegration,
} from './playwright-integration.js';

function invokeAdapter(command: string, args: string[], request: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Playwright adapter exited with ${code}: ${stderr}`));
    });
    child.stdin.end(JSON.stringify(request));
  });
}

test('installed Playwright adapter retains its package version and can serve its manifest', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-playwright-setup-'));
  try {
    const installation = await installPlaywrightIntegration({
      dataDirectory: join(fixture, '.panerelay'),
      homeDirectory: fixture,
      nodePath: process.execPath,
      playwrightInstallation: {
        executable: '/fixture/playwright-cli',
        supported: true,
        version: '0.1.17',
      },
    });
    const packageManifest = JSON.parse(
      await readFile(installation.paths.adapterPackagePath, 'utf8'),
    ) as { private?: boolean; type?: string; version?: string };
    assert.deepEqual(packageManifest, {
      name: '@panerelay/playwright-private',
      version: PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
      private: true,
      type: 'module',
    });
    const config = JSON.parse(await readFile(installation.paths.configPath, 'utf8')) as {
      endpoint?: string;
    };
    assert.equal(config.endpoint, PANERELAY_PLAYWRIGHT_GATEWAY_URL);

    const response = JSON.parse(
      await invokeAdapter(process.execPath, [installation.paths.adapterArtifactPath], {
        protocol: 'panerelay.cli-adapter.v1',
        requestId: 'installed-manifest',
        operation: 'adapter.manifest',
        input: {},
      }),
    ) as { success?: boolean; result?: { adapterId?: string; version?: string } };
    assert.equal(response.success, true);
    assert.equal(response.result?.adapterId, 'playwright');
    assert.equal(response.result?.version, PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION);
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('uninstalls only the Playwright adapter, config, and registration artifacts', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-playwright-uninstall-'));
  try {
    const installation = await installPlaywrightIntegration({
      dataDirectory: join(fixture, '.panerelay'),
      homeDirectory: fixture,
      nodePath: process.execPath,
      playwrightInstallation: {
        executable: '/fixture/playwright-cli',
        supported: true,
        version: '0.1.17',
      },
    });
    await Promise.all([
      access(installation.paths.adapterLauncherPath),
      access(installation.paths.adapterStorageDirectory),
      access(installation.paths.configPath),
    ]);

    await uninstallPlaywrightIntegration({
      dataDirectory: installation.paths.dataDirectory,
      homeDirectory: fixture,
    });

    for (const removedPath of [
      installation.paths.adapterLauncherPath,
      installation.paths.adapterStorageDirectory,
      installation.paths.configPath,
    ]) {
      await assert.rejects(access(removedPath), { code: 'ENOENT' });
    }
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});
