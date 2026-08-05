import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { conversationTargetSessionName, PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';
import {
  automationGatewayBootstrapRequest,
  automationGatewayFailureStatus,
  browserUseGatewayStatePath,
  PANERELAY_BROWSER_USE_GATEWAY_PORT,
  PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
  stopBrowserUseGateway,
} from './browser-use-gateway.js';

test('preserves bounded conflict and capacity gateway statuses', () => {
  assert.equal(automationGatewayFailureStatus(409), 409);
  assert.equal(automationGatewayFailureStatus(429), 429);
  assert.equal(automationGatewayFailureStatus(400), 503);
  assert.equal(automationGatewayFailureStatus(500), 503);
});

test('forwards a Playwright target selection into one exact bootstrap lane', () => {
  const target = {
    browserId: '11111111-1111-4111-8111-111111111111',
    targetId: '22222222-2222-4222-8222-222222222222',
  };
  const session = conversationTargetSessionName(target);
  assert.equal(session.length, 56);
  assert.match(session, /^panerelay-v2-[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(
    automationGatewayBootstrapRequest(
      { browserId: target.browserId, generation: 'generation-1' },
      target,
      'playwright',
    ),
    {
      protocol: PANERELAY_PROTOCOL_VERSION,
      browser: { browserId: target.browserId, generation: 'generation-1' },
      actor: { kind: 'automation', name: 'Playwright', sessionLabel: session },
      engine: 'playwright',
      laneKey: `playwright:${session}`,
      connectionPolicy: 'single',
      initialTargetId: target.targetId,
    },
  );
});

test('keeps ordinary Browser Use and Playwright bootstrap lanes unchanged', () => {
  const browser = { browserId: 'browser-1', generation: 'generation-1' };
  assert.equal(
    automationGatewayBootstrapRequest(browser, undefined, 'browser-use').laneKey,
    'browser-use:panerelay',
  );
  assert.equal(
    automationGatewayBootstrapRequest(browser, undefined, 'playwright').laneKey,
    'playwright:panerelay',
  );
});

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
