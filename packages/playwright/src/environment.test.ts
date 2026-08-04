import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PLAYWRIGHT_GATEWAY_URL,
  parsePlaywrightGatewaySelection,
  playwrightGatewayUrl,
  playwrightTargetGatewayUrl,
} from './environment.js';
import { playwrightVersionInvocation } from './index.js';

test('encodes explicit Playwright gateway selections and accepts standard version paths', () => {
  const selection = { browserId: 'opaque/browser', generation: 'generation-1' };
  const url = playwrightGatewayUrl(selection);
  assert.match(url, /\/cdp\/playwright\/browser\/[A-Za-z0-9_-]+$/);
  assert.deepEqual(
    parsePlaywrightGatewaySelection(new URL(`${url}/json/version/`).pathname),
    selection,
  );
  assert.equal(
    parsePlaywrightGatewaySelection(
      new URL(`${PANERELAY_PLAYWRIGHT_GATEWAY_URL}/json/version`).pathname,
    ),
    undefined,
  );
  assert.equal(
    parsePlaywrightGatewaySelection('/cdp/playwright/browser/not-valid!/json/version'),
    null,
  );
  for (const invalidSelection of [null, [], 'browser']) {
    const token = Buffer.from(JSON.stringify(invalidSelection), 'utf8').toString('base64url');
    assert.equal(
      parsePlaywrightGatewaySelection(`/cdp/playwright/browser/${token}/json/version`),
      null,
    );
  }
});

test('encodes exact target-scoped Playwright gateway selections', () => {
  const selection = {
    browserId: '11111111-1111-4111-8111-111111111111',
    targetId: '22222222-2222-4222-8222-222222222222',
  };
  const url = playwrightTargetGatewayUrl(selection);
  assert.match(url, /\/cdp\/playwright\/target\/[A-Za-z0-9_-]+$/);
  assert.deepEqual(
    parsePlaywrightGatewaySelection(new URL(`${url}/json/version`).pathname),
    selection,
  );
  const partial = Buffer.from(JSON.stringify({ browserId: selection.browserId }), 'utf8').toString(
    'base64url',
  );
  assert.equal(
    parsePlaywrightGatewaySelection(`/cdp/playwright/target/${partial}/json/version`),
    null,
  );
});

test('launches Windows Playwright command wrappers through the exact command interpreter', () => {
  const environment = { ComSpec: 'C:\\Windows\\System32\\cmd.exe' };
  const invocation = playwrightVersionInvocation(
    'C:\\Program Files\\Playwright CLI\\playwright-cli.cmd',
    environment,
    'win32',
  );
  assert.equal(invocation.command, environment.ComSpec);
  assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.match(invocation.args[3]!, /Playwright\^ CLI/);
  assert.match(invocation.args[3]!, /--version/);
  assert.equal(invocation.windowsVerbatimArguments, true);
});
