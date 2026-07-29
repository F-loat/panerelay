import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PACKAGE_DEFINITIONS,
  requiredExtensionHtmlEntries,
  requiredExtensionManifestEntries,
  validateExtensionEntries,
  validatePackedPackage,
  validateReleaseMetadata,
} from './release-lib.mjs';

function releaseFixture() {
  const version = '0.1.0-alpha.1';
  const descriptor = {
    version,
    extensionVersion: '0.1.0.1',
    agentBrowserVersion: '0.33.0',
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
    ...(index === 0 ? {} : { dependencies: { [descriptor.packages[0]]: 'workspace:*' } }),
  }));
  return {
    descriptor,
    extensionManifest: { version: '0.1.0.1', version_name: version },
    extensionPackage: { version, private: true },
    packageManifests,
    rootPackage: { version, private: true, repository },
  };
}

test('accepts one lockstep release identity and rejects version drift', () => {
  const fixture = releaseFixture();
  assert.doesNotThrow(() => validateReleaseMetadata(fixture));
  fixture.packageManifests[2].version = '0.1.0-alpha.2';
  assert.throws(() => validateReleaseMetadata(fixture), /not lockstep/);
});

test('rejects workspace references and incomplete packed package contents', () => {
  const requiredEntries = ['package/dist/index.js', 'package/package.json'];
  const manifest = {
    name: '@panerelay/setup',
    version: '0.1.0-alpha.1',
    publishConfig: { access: 'public' },
    exports: { '.': './dist/index.js' },
    dependencies: { '@panerelay/protocol': '0.1.0-alpha.1' },
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
