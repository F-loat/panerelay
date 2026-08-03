import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_PROTOCOL_VERSION } from './constants.js';
import {
  isCdpBootstrapCreated,
  isCdpBootstrapGeneration,
  isCdpBootstrapLaneKey,
  isCdpBootstrapRequest,
} from './cdp-bootstrap.js';

const request = {
  protocol: PANERELAY_PROTOCOL_VERSION,
  browser: { browserId: 'opaque-browser', generation: 'native-host-generation-1' },
  actor: { kind: 'automation', name: 'Browser Use', sessionLabel: 'persistent-lane' },
  engine: 'browser-use',
  laneKey: 'browser-use:default',
  connectionPolicy: 'single',
} as const;

test('validates bounded single-connection CDP bootstrap requests', () => {
  assert.equal(isCdpBootstrapRequest(request), true);
  assert.equal(
    isCdpBootstrapRequest({
      ...request,
      actor: { kind: 'automation', name: 'Playwright CLI', sessionLabel: 'panerelay' },
      engine: 'playwright',
      laneKey: 'playwright:panerelay',
    }),
    true,
  );
  assert.equal(isCdpBootstrapRequest({ ...request, connectionPolicy: 'multiple' }), false);
  assert.equal(isCdpBootstrapRequest({ ...request, laneKey: '../lane' }), false);
  assert.equal(
    isCdpBootstrapRequest({ ...request, engine: 'playwright', laneKey: 'playwright/lane' }),
    false,
  );
  assert.equal(isCdpBootstrapRequest({ ...request, extra: true }), false);
  assert.equal(isCdpBootstrapRequest({ ...request, engine: 'Browser Use' }), false);
  assert.equal(isCdpBootstrapRequest({ ...request, engine: 'playwright-cli' }), false);
  assert.equal(isCdpBootstrapRequest({ ...request, engine: 'agent-browser' }), true);
  assert.equal(
    isCdpBootstrapRequest({ ...request, actor: { ...request.actor, name: 'x'.repeat(65) } }),
    false,
  );
  assert.equal(
    isCdpBootstrapRequest({
      ...request,
      browser: { ...request.browser, generation: 'x'.repeat(129) },
    }),
    false,
  );
});

test('validates opaque lane and generation identifiers', () => {
  assert.equal(isCdpBootstrapLaneKey('browser-use:lane_1'), true);
  assert.equal(isCdpBootstrapLaneKey(''), false);
  assert.equal(isCdpBootstrapGeneration('host:1234-generation'), true);
  assert.equal(isCdpBootstrapGeneration('generation/1'), false);
});

test('accepts only loopback HTTP bootstrap URLs', () => {
  assert.equal(
    isCdpBootstrapCreated({
      protocol: PANERELAY_PROTOCOL_VERSION,
      cdpUrl: 'http://127.0.0.1:41234/cdp/bootstrap/ticket-id',
      expiresAt: '2026-08-01T01:02:03.000Z',
    }),
    true,
  );
  assert.equal(
    isCdpBootstrapCreated({
      protocol: PANERELAY_PROTOCOL_VERSION,
      cdpUrl: 'http://localhost:41234/cdp/bootstrap/ticket-id',
      expiresAt: '2026-08-01T01:02:03.000Z',
    }),
    false,
  );
});
