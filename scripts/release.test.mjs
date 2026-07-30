import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PACKAGE_DEFINITIONS,
  requiredExtensionHtmlEntries,
  requiredExtensionManifestEntries,
  validateExtensionEntries,
  validatePackedPackage,
  validateReleaseMetadata,
} from './release-lib.mjs';

const extensionKey = JSON.parse(
  readFileSync(new URL('../apps/extension/manifest.json', import.meta.url), 'utf8'),
).key;

function releaseFixture() {
  const version = '0.1.0';
  const descriptor = {
    version,
    extensionVersion: '0.1.0.2',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    agentBrowserMinimumVersion: '0.33.0',
    agentBrowserVerifiedVersions: ['0.33.0'],
    packages: PACKAGE_DEFINITIONS.map(definition => definition.name),
  };
  const repository = { url: 'git+https://github.com/F-loat/panerelay.git' };
  const packageManifests = descriptor.packages.map((name, index) => ({
    name,
    version,
    license: 'MIT',
    engines: { node: '>=20' },
    publishConfig: { access: 'public' },
    repository,
    ...(index === 0
      ? {}
      : {
          dependencies: {
            [descriptor.packages[0]]: 'workspace:*',
            ...(name === '@panerelay/bridge' ? { '@agentclientprotocol/sdk': '^1.3.0' } : {}),
          },
        }),
  }));
  return {
    compatibilityRecords: ['agent-browser-0.33.0.md'],
    descriptor,
    extensionManifest: { version: '0.1.0.2', version_name: version, key: extensionKey },
    extensionPackage: { version, private: true },
    implementationSources: {
      browserRelay: 'message.extensionId !== this.options.expectedExtensionId',
      extensionBackground: 'extensionId: chrome.runtime.id',
      hostInstallation:
        "allowed_origins: [`chrome-extension://${extensionId}/`]\nsetlocal DisableDelayedExpansion\n'reg.exe'",
      protocolConstants: "export const PANERELAY_EXTENSION_ID = 'panplnkjlkoceaonlmpdekjphgmbggmi'",
      qoderProvider: "spawn(command, ['--acp'])",
    },
    packageManifests,
    rootPackage: { version, private: true, repository },
  };
}

test('accepts one lockstep release identity and rejects version drift', () => {
  const fixture = releaseFixture();
  assert.doesNotThrow(() => validateReleaseMetadata(fixture));
  fixture.packageManifests[2].version = '0.1.1';
  assert.throws(() => validateReleaseMetadata(fixture), /not lockstep/);
});

test('rejects stale alpha, identity drift, missing evidence, and unsupported ACP metadata', () => {
  const alpha = releaseFixture();
  alpha.descriptor.version = '0.1.0-alpha.1';
  assert.throws(() => validateReleaseMetadata(alpha), /without alpha metadata/);

  const identityDrift = releaseFixture();
  identityDrift.descriptor.extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  assert.throws(() => validateReleaseMetadata(identityDrift), /official Extension ID/);

  const missingEvidence = releaseFixture();
  missingEvidence.compatibilityRecords = [];
  assert.throws(() => validateReleaseMetadata(missingEvidence), /Missing compatibility record/);

  const unsupportedAcp = releaseFixture();
  unsupportedAcp.packageManifests.find(
    manifest => manifest.name === '@panerelay/bridge',
  ).dependencies['@agentclientprotocol/sdk'] = '^1.1.0';
  assert.throws(() => validateReleaseMetadata(unsupportedAcp), /must package/);
});

test('rejects workspace references and incomplete packed package contents', () => {
  const requiredEntries = ['package/dist/index.js', 'package/package.json'];
  const manifest = {
    name: '@panerelay/setup',
    version: '0.1.0',
    publishConfig: { access: 'public' },
    exports: { '.': './dist/index.js' },
    dependencies: { '@panerelay/protocol': '0.1.0' },
  };
  assert.doesNotThrow(() =>
    validatePackedPackage({
      entries: requiredEntries,
      manifest,
      manifestText: JSON.stringify(manifest),
      name: manifest.name,
      requiredEntries,
      version: manifest.version,
    }),
  );
  assert.throws(
    () =>
      validatePackedPackage({
        entries: requiredEntries,
        manifest,
        manifestText: `${JSON.stringify(manifest)} workspace:*`,
        name: manifest.name,
        requiredEntries,
        version: manifest.version,
      }),
    /workspace reference/,
  );
  assert.throws(
    () =>
      validatePackedPackage({
        entries: ['package/package.json'],
        manifest,
        manifestText: JSON.stringify(manifest),
        name: manifest.name,
        requiredEntries,
        version: manifest.version,
      }),
    /missing package\/dist\/index.js/,
  );
});

test('validates nested Vite Extension output from manifest and HTML references', () => {
  const manifest = {
    manifest_version: 3,
    background: { service_worker: 'service-worker-loader.js', type: 'module' },
    side_panel: { default_path: 'src/pages/sidepanel/index.html' },
    icons: { 16: 'icons/icon16.png' },
  };
  const manifestEntries = requiredExtensionManifestEntries(manifest);
  const htmlEntries = requiredExtensionHtmlEntries(
    manifest.side_panel.default_path,
    '<script type="module" src="/assets/sidepanel-abc.js"></script>' +
      '<link rel="stylesheet" href="/assets/sidepanel-def.css">',
  );
  const entries = [...manifestEntries, 'assets/sidepanel-abc.js', 'assets/sidepanel-def.css'];

  assert.doesNotThrow(() =>
    validateExtensionEntries(entries, [...manifestEntries, ...htmlEntries]),
  );
  assert.throws(
    () => validateExtensionEntries(manifestEntries, [...manifestEntries, ...htmlEntries]),
    /Extension build is missing assets\/sidepanel-abc\.js/,
  );
});
