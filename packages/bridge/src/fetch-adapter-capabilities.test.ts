import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_FETCH_ADAPTER_REGISTRY_PATH_ENV, runFetchCommand } from '@panerelay/cli';
import {
  PANERELAY_PROTOCOL_VERSION,
  type BrowserFetchRequestMessage,
  type BridgeState,
} from '@panerelay/protocol';
import { BrowserRelay } from './browser-relay.js';

const ADAPTER_SOURCE = String.raw`
const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const invocation = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const artifact = invocation.artifacts?.[0];
if (!artifact || invocation.args.document !== artifact.id) throw new Error('Missing artifact');
const boundary = 'panerelay-complete-path-fixture';
const multipart = Buffer.concat([
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="label"\r\n\r\ndocument\r\n'),
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="document"; filename="' + artifact.basename + '"\r\nContent-Type: ' + artifact.mediaType + '\r\n\r\n'),
  Buffer.from(artifact.data, 'base64'),
  Buffer.from('\r\n--' + boundary + '--\r\n'),
]);
const fetched = await fetch(invocation.fetch.endpoint, {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + invocation.fetch.token,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://api.example.test/upload',
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=' + boundary },
    body: { encoding: 'base64', data: multipart.toString('base64') },
    responseType: 'json',
    withCookies: false,
  }),
});
const response = await fetched.json();
process.stdout.write(JSON.stringify({
  protocol: 'panerelay.fetch-adapter.v3',
  requestId: invocation.requestId,
  operation: 'execute',
  success: true,
  result: { response: response.body },
}));
`;

test('runs multipart input through CLI, Bridge, and the Extension boundary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-complete-fetch-'));
  await chmod(root, 0o700);
  t.after(() => rm(root, { force: true, recursive: true }));
  const registryPath = join(root, 'registry.json');
  const adapterDirectory = join(root, 'fixture-upload', '1.0.0');
  const executablePath = join(adapterDirectory, 'adapter.mjs');
  const inputPath = join(root, 'fixture.txt');
  await mkdir(adapterDirectory, { recursive: true, mode: 0o700 });
  await chmod(join(root, 'fixture-upload'), 0o700);
  await chmod(adapterDirectory, 0o700);
  await writeFile(executablePath, ADAPTER_SOURCE, { mode: 0o600 });
  await writeFile(inputPath, 'multipart fixture payload', { mode: 0o600 });

  const manifest = {
    protocol: 'panerelay.fetch-adapter.v3' as const,
    id: 'fixture-upload',
    name: 'Fixture upload',
    version: '1.0.0',
    description: 'Complete multipart path fixture.',
    origins: ['https://api.example.test'],
    entry: 'adapter.mjs',
    commands: [
      {
        name: 'upload',
        description: 'Upload one fixture.',
        access: 'write' as const,
        args: [
          {
            name: 'document',
            description: 'Fixture file.',
            type: 'file' as const,
            required: true,
            positional: true,
          },
        ],
        output: ['response'],
        examples: ['panerelay fixture-upload upload fixture.txt'],
      },
    ],
  };
  await writeFile(
    registryPath,
    `${JSON.stringify({
      protocol: 'panerelay.fetch-adapter-registry.v3',
      adapters: [
        {
          manifest,
          executablePath,
          sha256: createHash('sha256')
            .update(await readFile(executablePath))
            .digest('hex'),
        },
      ],
    })}\n`,
    { mode: 0o600 },
  );
  const environment = {
    [PANERELAY_FETCH_ADAPTER_REGISTRY_PATH_ENV]: registryPath,
  };

  let extensionRequest: BrowserFetchRequestMessage | undefined;
  let multipartText = '';
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => undefined,
    onBrowserRegistered: () => undefined,
    sendToExtension: message => {
      if (message.type !== 'fetch.request') return;
      extensionRequest = message;
      if (message.request.body?.encoding === 'base64') {
        multipartText = Buffer.from(message.request.body.data, 'base64').toString('utf8');
      }
      queueMicrotask(() => {
        void relay.handleExtensionMessage({
          type: 'fetch.result',
          protocol: PANERELAY_PROTOCOL_VERSION,
          requestId: message.requestId,
          success: true,
          response: {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: {
              accepted: multipartText.includes('multipart fixture payload'),
            },
            bodyType: 'json',
            url: message.request.url,
            redirected: false,
            attachedCookieCount: 0,
          },
        });
      });
    },
  });
  t.after(() => relay.close());
  await relay.handleExtensionMessage({
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: 'browser-1',
    browserName: 'Fixture Chrome',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    releaseVersion: '0.8.0',
    buildVersion: '0.8.0.0',
    checkHostUpdate: false,
    capabilities: { cdpRelay: true, browserFetch: true },
  });
  const state: BridgeState = {
    protocol: 'panerelay.relay.v2',
    pid: process.pid,
    port: relay.port,
    token: relay.token,
    generation: relay.generation,
    browserId: 'browser-1',
    browserName: 'Fixture Chrome',
    capabilities: { cdpRelay: true, browserFetch: true },
    extensionReleaseVersion: '0.8.0',
    extensionBuildVersion: '0.8.0.0',
    hostVersion: '0.8.0',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    updatedAt: new Date().toISOString(),
  };
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await runFetchCommand(['fixture-upload', 'upload', inputPath, '--json'], {
        locale: 'en',
        environment,
        dependencies: {
          selectBrowserFetchRegistration: async () => ({ source: 'single', state }),
        },
      }),
      0,
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(extensionRequest?.request.headers?.Authorization, undefined);
  assert.match(multipartText, /name="document"; filename="fixture\.txt"/);
  assert.match(multipartText, /multipart fixture payload/);
  assert.doesNotMatch(multipartText, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const serialized = output.join('\n');
  assert.doesNotMatch(serialized, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(JSON.parse(output[0] ?? '{}').response.accepted, true);
});
