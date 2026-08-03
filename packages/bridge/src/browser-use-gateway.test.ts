import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  browserUseGatewayStatePath,
  PANERELAY_BROWSER_USE_GATEWAY_PORT,
  PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
  stopBrowserUseGateway,
} from './browser-use-gateway.js';

test('reports an absent Browser Use gateway during uninstall', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-gateway-'));
  try {
    assert.equal(await stopBrowserUseGateway({ homeDirectory }), 'absent');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('does not stop a gateway with invalid or mismatched ownership state', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-gateway-state-'));
  const statePath = browserUseGatewayStatePath(homeDirectory);
  try {
    await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
    await writeFile(
      statePath,
      JSON.stringify({
        protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
        port: PANERELAY_BROWSER_USE_GATEWAY_PORT + 1,
        pid: process.pid,
      }),
    );
    assert.equal(await stopBrowserUseGateway({ homeDirectory }), 'remaining');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});
