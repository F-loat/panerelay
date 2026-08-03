import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  browserUseGatewayUrl,
  browserUseEnvironmentPath,
  parseBrowserUseGatewaySelection,
  PANERELAY_BROWSER_USE_GATEWAY_URL,
  setBrowserUseEnvironmentMode,
} from './environment.js';

test('encodes and validates one-run Browser Use gateway selections', () => {
  const selection = { browserId: 'opaque/browser', generation: 'generation-1' };
  const url = browserUseGatewayUrl(selection);
  assert.match(url, /\/cdp\/browser-use\/browser\/[A-Za-z0-9_-]+$/);
  assert.deepEqual(
    parseBrowserUseGatewaySelection(new URL(`${url}/json/version`).pathname),
    selection,
  );
  assert.equal(parseBrowserUseGatewaySelection('/cdp/browser-use/json/version'), undefined);
  assert.equal(
    parseBrowserUseGatewaySelection('/cdp/browser-use/browser/not-valid!/json/version'),
    null,
  );
});

test('writes the fixed Browser Use gateway and preserves unrelated environment keys', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-'));
  const homeDirectory = join(root, 'home');
  const path = browserUseEnvironmentPath(homeDirectory);
  try {
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    let content = await readFile(path, 'utf8');
    assert.match(content, new RegExp(`BU_CDP_URL="${PANERELAY_BROWSER_USE_GATEWAY_URL}"`));
    assert.match(content, /BH_TELEMETRY="0"/);
    assert.match(content, /BU_NAME="panerelay"/);
    assert.doesNotMatch(content, /BH_RUNTIME_DIR=/);
    assert.doesNotMatch(content, /BH_TMP_DIR=/);

    await writeFile(
      path,
      `${content}BH_RUNTIME_DIR="/legacy/runtime"\nBH_TMP_DIR="/legacy/tmp"\nCUSTOM_BROWSER_FLAG="keep-me"\n`,
    );
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    content = await readFile(path, 'utf8');
    assert.doesNotMatch(content, /BH_RUNTIME_DIR=/);
    assert.doesNotMatch(content, /BH_TMP_DIR=/);

    await setBrowserUseEnvironmentMode('direct', { homeDirectory });
    content = await readFile(path, 'utf8');
    assert.match(content, /CUSTOM_BROWSER_FLAG="keep-me"/);
    assert.doesNotMatch(content, /BU_CDP_URL=/);
    assert.doesNotMatch(content, /BH_TELEMETRY=/);
    assert.doesNotMatch(content, /BU_NAME=/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('removes an environment file when direct mode has no unrelated settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-empty-'));
  const homeDirectory = join(root, 'home');
  const path = browserUseEnvironmentPath(homeDirectory);
  try {
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    await setBrowserUseEnvironmentMode('direct', { homeDirectory });
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('uses Browser Harness workspace overrides and safely serializes managed values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-workspace-'));
  const homeDirectory = join(root, 'home');
  const workspace = join(root, 'browser-harness-workspace');
  const environment = {
    HOME: join(root, 'environment-home'),
    BH_AGENT_WORKSPACE: workspace,
  };
  const path = browserUseEnvironmentPath(homeDirectory, environment);
  const gatewayUrl = 'http://127.0.0.1/route\\segment"quoted';
  try {
    assert.equal(path, join(workspace, '.env'));
    await setBrowserUseEnvironmentMode('extension', {
      environment,
      gatewayUrl,
      homeDirectory,
    });
    let content = await readFile(path, 'utf8');
    const serializedGateway = gatewayUrl.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    assert.ok(content.includes(`BU_CDP_URL="${serializedGateway}"`));

    await writeFile(path, `${content}export BU_CDP_URL="stale"\n`);
    await setBrowserUseEnvironmentMode('extension', { environment, homeDirectory });
    content = await readFile(path, 'utf8');
    assert.equal((content.match(/BU_CDP_URL=/g) ?? []).length, 1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
