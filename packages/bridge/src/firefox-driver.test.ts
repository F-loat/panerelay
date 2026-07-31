import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  FirefoxDriverManager,
  geckodriverConnectExistingArguments,
  parseGeckodriverListeningPort,
} from './firefox-driver.js';
import type { FirefoxAutomationRuntimeConfig } from './firefox-automation.js';

class FakeStream extends EventEmitter {}

class FakeProcess extends EventEmitter {
  readonly stderr = new FakeStream();
  readonly stdout = new FakeStream();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

const config: FirefoxAutomationRuntimeConfig = {
  firefoxPath: '/Applications/Firefox.app/Contents/MacOS/firefox',
  geckodriverPath: '/usr/local/bin/geckodriver',
  managedToken: 'managed',
  marionettePort: 2828,
  runtimeStatePath: '/tmp/panerelay-firefox-runtime.json',
};

test('uses loopback connect-existing geckodriver flags without system access', () => {
  const args = geckodriverConnectExistingArguments(2828);
  assert.deepEqual(args.slice(0, 4), ['--host', '127.0.0.1', '--port', '0']);
  assert.ok(args.includes('--connect-existing'));
  assert.ok(!args.includes('--allow-system-access'));
  assert.equal(parseGeckodriverListeningPort('Listening on 127.0.0.1:43125'), 43125);
  assert.equal(parseGeckodriverListeningPort('Listening on 0.0.0.0:43125'), undefined);
});

test('starts a real existing-browser session only in a correlated managed environment', async () => {
  const child = new FakeProcess();
  const requests: Array<{ method: string; url: string; body?: string }> = [];
  const manager = new FirefoxDriverManager(config, {
    managedEnvironment: async () => true,
    spawnDriver: (() => {
      queueMicrotask(() => child.stderr.emit('data', 'Listening on 127.0.0.1:43125\n'));
      return child;
    }) as never,
    fetchImplementation: (async (url: string | URL, init?: RequestInit) => {
      requests.push({
        method: init?.method || 'GET',
        url: String(url),
        ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      });
      if (String(url).endsWith('/session')) {
        return new Response(JSON.stringify({ value: { sessionId: 'real-session' } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ value: { ready: true } }), { status: 200 });
    }) as typeof fetch,
  });

  const result = await manager.ensureReady();
  assert.equal(result.ready, true);
  assert.equal(manager.sessionId, 'real-session');
  assert.deepEqual(
    requests.map(request => [request.method, request.url]),
    [
      ['GET', 'http://127.0.0.1:43125/status'],
      ['POST', 'http://127.0.0.1:43125/session'],
    ],
  );
  await manager.close();
  assert.equal(child.killed, true);
});

test('reports a managed restart requirement without spawning a driver', async () => {
  let spawned = false;
  const manager = new FirefoxDriverManager(config, {
    managedEnvironment: async () => false,
    spawnDriver: (() => {
      spawned = true;
      return new FakeProcess();
    }) as never,
  });

  const result = await manager.ensureReady();
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'managed-restart-required');
  assert.equal(spawned, false);
});
