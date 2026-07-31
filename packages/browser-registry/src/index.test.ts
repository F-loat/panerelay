import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_PROTOCOL_VERSION, type BridgeState } from '@panerelay/protocol';
import {
  PANERELAY_BROWSER_ENV,
  PANERELAY_BROWSER_ID_ENV,
  browserDefaultPath,
  browserRegistrationPath,
  clearBrowserDefault,
  listBrowserRegistrations,
  readBrowserDefault,
  readLiveBrowserRegistration,
  removeOwnedBrowserRegistration,
  selectBrowserRegistration,
  setBrowserDefault,
  writeBrowserRegistration,
  type BrowserRegistryOptions,
} from './index.js';

function state(
  browserId: string,
  pid: number,
  family: BridgeState['browserFamily'],
  ready = true,
): BridgeState {
  return {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid,
    port: 41_000 + pid,
    token: `token-${browserId}`,
    browserId,
    browserName: `${family ?? 'unknown'} ${browserId}`,
    browserFamily: family,
    capabilities: { cdpRelay: ready },
    extensionVersion: '0.2.0',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    updatedAt: '2026-07-31T08:00:00.000Z',
  };
}

async function fixture(): Promise<{
  directory: string;
  options: BrowserRegistryOptions;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-browser-registry-'));
  return {
    directory,
    options: {
      registryDirectory: join(directory, 'browsers'),
      defaultPath: join(directory, 'browser-default.json'),
      legacyPath: join(directory, 'bridge.json'),
      isProcessAlive: pid => pid === 101 || pid === 102 || pid === 103,
      environment: {},
    },
  };
}

test('retains independent live registrations and removes only an owned entry', async () => {
  const { directory, options } = await fixture();
  try {
    await writeBrowserRegistration(state('chrome-id', 101, 'chrome'), options);
    await writeBrowserRegistration(state('edge-id', 102, 'edge'), options);

    assert.deepEqual(
      (await listBrowserRegistrations(options)).map(item => [
        item.state.browserId,
        item.state.browserFamily,
        item.ready,
      ]),
      [
        ['chrome-id', 'chrome', true],
        ['edge-id', 'edge', true],
      ],
    );

    await removeOwnedBrowserRegistration('chrome-id', 102, options);
    assert.equal((await readLiveBrowserRegistration('chrome-id', options))?.pid, 101);

    await removeOwnedBrowserRegistration('chrome-id', 101, options);
    assert.equal(await readLiveBrowserRegistration('chrome-id', options), null);
    assert.equal((await readLiveBrowserRegistration('edge-id', options))?.pid, 102);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ignores malformed, mismatched, and stale registration entries', async () => {
  const { directory, options } = await fixture();
  try {
    await writeBrowserRegistration(state('live-id', 101, 'chrome'), options);
    await writeFile(browserRegistrationPath('malformed-id', options), '{broken');
    await writeFile(
      browserRegistrationPath('wrong-path-id', options),
      JSON.stringify(state('different-id', 102, 'edge')),
    );
    await writeBrowserRegistration(state('stale-id', 999, 'edge'), options);

    assert.deepEqual(
      (await listBrowserRegistrations(options)).map(item => item.state.browserId),
      ['live-id'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('stores and conditionally clears a protected saved default', async () => {
  const { directory, options } = await fixture();
  try {
    const saved = await setBrowserDefault('edge-id', options);
    assert.equal((await readBrowserDefault(options))?.browserId, 'edge-id');
    assert.equal((await clearBrowserDefault('chrome-id', options))?.browserId, 'edge-id');
    assert.equal((await clearBrowserDefault('edge-id', options))?.browserId, undefined);

    const persisted = JSON.parse(
      await readFile(browserDefaultPath(options), 'utf8').catch(() => '{}'),
    );
    assert.deepEqual(persisted, {});
    assert.equal(saved.protocol, PANERELAY_PROTOCOL_VERSION);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('selects explicit IDs and unambiguous families before the saved default', async () => {
  const { directory, options } = await fixture();
  try {
    await writeBrowserRegistration(state('chrome-id', 101, 'chrome'), options);
    await writeBrowserRegistration(state('edge-id', 102, 'edge'), options);
    await setBrowserDefault('chrome-id', options);

    const byId = await selectBrowserRegistration({
      ...options,
      environment: { [PANERELAY_BROWSER_ID_ENV]: 'edge-id' },
    });
    assert.equal(byId.source, 'explicit');
    assert.equal(byId.state.browserId, 'edge-id');

    const byFamily = await selectBrowserRegistration({
      ...options,
      environment: { [PANERELAY_BROWSER_ENV]: 'edge' },
    });
    assert.equal(byFamily.state.browserId, 'edge-id');

    const byDefault = await selectBrowserRegistration(options);
    assert.equal(byDefault.source, 'default');
    assert.equal(byDefault.state.browserId, 'chrome-id');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails closed for ambiguous families and unavailable defaults', async () => {
  const { directory, options } = await fixture();
  try {
    await writeBrowserRegistration(state('chrome-a', 101, 'chrome'), options);
    await writeBrowserRegistration(state('chrome-b', 102, 'chrome'), options);

    await assert.rejects(
      selectBrowserRegistration({
        ...options,
        environment: { [PANERELAY_BROWSER_ENV]: 'chrome' },
      }),
      /ambiguous.*chrome-a.*chrome-b/i,
    );

    await setBrowserDefault('offline-id', options);
    await assert.rejects(selectBrowserRegistration(options), /default.*offline-id.*unavailable/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('uses the only ready registration and never selects an explicitly incapable browser', async () => {
  const { directory, options } = await fixture();
  try {
    await writeBrowserRegistration(state('chrome-id', 101, 'chrome', false), options);
    await writeBrowserRegistration(state('edge-id', 102, 'edge'), options);

    const automatic = await selectBrowserRegistration(options);
    assert.equal(automatic.source, 'single');
    assert.equal(automatic.state.browserId, 'edge-id');

    await assert.rejects(
      selectBrowserRegistration({
        ...options,
        environment: { [PANERELAY_BROWSER_ID_ENV]: 'chrome-id' },
      }),
      /cannot provide a CDP relay/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('uses a live legacy singleton only when no current registration exists', async () => {
  const { directory, options } = await fixture();
  try {
    const legacy = state('legacy-id', 103, 'chrome');
    await writeFile(options.legacyPath!, JSON.stringify(legacy));

    const selectedLegacy = await selectBrowserRegistration(options);
    assert.equal(selectedLegacy.source, 'legacy');
    assert.equal(selectedLegacy.state.browserId, 'legacy-id');

    const explicitlySelectedLegacy = await selectBrowserRegistration({
      ...options,
      environment: { [PANERELAY_BROWSER_ID_ENV]: 'legacy-id' },
    });
    assert.equal(explicitlySelectedLegacy.source, 'legacy');
    assert.equal(explicitlySelectedLegacy.state.browserId, 'legacy-id');

    await writeBrowserRegistration(state('edge-id', 102, 'edge'), options);
    const selectedCurrent = await selectBrowserRegistration(options);
    assert.equal(selectedCurrent.source, 'single');
    assert.equal(selectedCurrent.state.browserId, 'edge-id');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
