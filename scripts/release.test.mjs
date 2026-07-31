import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PACKAGE_DEFINITIONS,
  commandOutputLines,
  commandInvocation,
  requiredExtensionHtmlEntries,
  requiredExtensionManifestEntries,
  validateExtensionEntries,
  validatePackedPackage,
  validateReleaseIdentity,
  validateReleaseMetadata,
} from './release-lib.mjs';

const extensionKey = JSON.parse(
  readFileSync(new URL('../apps/extension/manifest.json', import.meta.url), 'utf8'),
).key;
const releaseWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);
const prepareReleaseWorkflow = readFileSync(
  new URL('../.github/workflows/prepare-release.yml', import.meta.url),
  'utf8',
);
const rootReadme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const rootReadmeZhCn = readFileSync(new URL('../README.zh-CN.md', import.meta.url), 'utf8');
const setupReadme = readFileSync(new URL('../packages/setup/README.md', import.meta.url), 'utf8');
const rootLicense = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

function releaseFixture() {
  const version = '0.1.0';
  const descriptor = {
    version,
    extensionVersion: '0.1.0.2',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    agentBrowserMinimumVersion: '0.33.0',
    agentBrowserVerifiedVersions: ['0.33.0'],
    claudeCodeMinimumVersion: '2.1.206',
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
            ...(name === '@panerelay/bridge'
              ? {
                  '@agentclientprotocol/sdk': '^1.3.0',
                }
              : {}),
          },
        }),
  }));
  return {
    compatibilityRecords: ['agent-browser-0.33.0.md'],
    descriptor,
    extensionManifest: { version: '0.1.0.2', version_name: version, key: extensionKey },
    extensionPackage: { version, private: true },
    implementationSources: {
      bridgeCompatibility: "export const CLAUDE_CODE_MINIMUM_VERSION = '2.1.206'",
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

test('invokes npm and pnpm through the Windows command processor', () => {
  const environment = { ComSpec: 'C:\\Windows\\System32\\cmd.exe' };
  assert.deepEqual(
    commandInvocation('pnpm', ['run', 'build'], { environment, platform: 'win32' }),
    {
      args: ['/d', '/c', 'pnpm.cmd', 'run', 'build'],
      command: environment.ComSpec,
    },
  );
  assert.deepEqual(
    commandInvocation('npm', ['install', '--no-audit'], { environment, platform: 'win32' }),
    {
      args: ['/d', '/c', 'npm.cmd', 'install', '--no-audit'],
      command: environment.ComSpec,
    },
  );
  assert.deepEqual(commandInvocation('git', ['status'], { environment, platform: 'win32' }), {
    args: ['status'],
    command: 'git',
  });
  assert.deepEqual(commandInvocation('pnpm', ['run', 'build'], { platform: 'linux' }), {
    args: ['run', 'build'],
    command: 'pnpm',
  });
});

test('normalizes Windows command output before validating archive entries', () => {
  assert.deepEqual(commandOutputLines('package/LICENSE\r\npackage/package.json\r\n'), [
    'package/LICENSE',
    'package/package.json',
  ]);
});

test('keeps release publication manual, protected, and channel-scoped', () => {
  assert.match(releaseWorkflow, /workflow_dispatch:/);
  assert.match(releaseWorkflow, /options:\n\s+- beta\n\s+- stable/);
  assert.match(releaseWorkflow, /group: panerelay-release\n\s+cancel-in-progress: false/);
  assert.match(releaseWorkflow, /environment: release/);
  assert.match(releaseWorkflow, /id-token: write/);
  assert.match(releaseWorkflow, /actions\/upload-artifact@v7/g);
  assert.match(releaseWorkflow, /actions\/download-artifact@v8/g);
  assert.match(releaseWorkflow, /node scripts\/publish-release\.mjs/);
  assert.match(releaseWorkflow, /if: needs\.prepare\.outputs\.channel == 'stable'/);
  assert.match(releaseWorkflow, /gh release create "\$RELEASE_TAG"/);
  const stableReleaseOffset = releaseWorkflow.indexOf('\n  stable-release:');
  assert.ok(stableReleaseOffset > 0);
  const preparationAndPublication = releaseWorkflow.slice(0, stableReleaseOffset);
  const stableRelease = releaseWorkflow.slice(stableReleaseOffset);
  assert.doesNotMatch(preparationAndPublication, /contents: write/);
  assert.match(
    preparationAndPublication,
    /extension_archive[\s\S]+artifact_directory.*inventory\.json[\s\S]+artifact_directory.*SHA256SUMS/,
  );
  assert.match(stableRelease, /awk -v archive="\$extension_archive"/);
  assert.match(stableRelease, /test "\$\(wc -l < release-assets\/SHA256SUMS\.public\)" -eq 1/);
  assert.match(stableRelease, /release-assets\/panerelay-extension-"\$RELEASE_VERSION"\.zip/);
  assert.match(stableRelease, /release-assets\/SHA256SUMS/);
  assert.doesNotMatch(stableRelease, /release-assets\/inventory\.json/);
  assert.doesNotMatch(releaseWorkflow, /NPM_TOKEN|git push|git tag/);
});

test('keeps official installation guidance Store-first and version-neutral', () => {
  const englishQuickstart = rootReadme.slice(
    rootReadme.indexOf('## Quickstart'),
    rootReadme.indexOf('## What Panerelay provides'),
  );
  const chineseQuickstart = rootReadmeZhCn.slice(
    rootReadmeZhCn.indexOf('## 快速开始'),
    rootReadmeZhCn.indexOf('## Panerelay 提供什么'),
  );

  for (const guidance of [englishQuickstart, chineseQuickstart, setupReadme]) {
    assert.match(guidance, new RegExp(chromeWebStoreUrl.replaceAll('.', '\\.')));
    assert.match(guidance, /npx --yes @panerelay\/setup/);
    assert.doesNotMatch(guidance, /@panerelay\/setup@\d+\.\d+\.\d+/);
  }
  assert.doesNotMatch(englishQuickstart, /Panerelay Releases|chrome:\/\/extensions/);
  assert.doesNotMatch(chineseQuickstart, /Panerelay Releases|chrome:\/\/extensions/);
  assert.match(
    rootReadme,
    /load `apps\/extension\/dist` as an unpacked Extension in Chrome or Edge/,
  );
  assert.match(rootReadmeZhCn, /在 Chrome 或 Edge 中将 `apps\/extension\/dist` 加载为未打包扩展/);
});

test('keeps selectable release preparation reviewable and non-publishing', () => {
  assert.match(prepareReleaseWorkflow, /^name: Prepare Release$/m);
  assert.match(prepareReleaseWorkflow, /workflow_dispatch:/);
  assert.match(
    prepareReleaseWorkflow,
    /increment:\n\s+description:[^\n]+\n\s+required: true\n\s+default: minor\n\s+type: choice\n\s+options:\n\s+- major\n\s+- minor\n\s+- patch/,
  );
  assert.match(
    prepareReleaseWorkflow,
    /group: panerelay-prepare-release\n\s+cancel-in-progress: false/,
  );
  assert.match(prepareReleaseWorkflow, /contents: write/);
  assert.match(prepareReleaseWorkflow, /pull-requests: write/);
  assert.match(
    prepareReleaseWorkflow,
    /pnpm run release:prepare -- --increment "\$RELEASE_INCREMENT"/,
  );
  assert.match(prepareReleaseWorkflow, /refs\/tags\/\$base_tag/);
  assert.match(prepareReleaseWorkflow, /refs\/heads\/\$PREPARE_BRANCH/);
  assert.match(prepareReleaseWorkflow, /npm view "\$package_name@\$TARGET_VERSION"/);
  assert.match(prepareReleaseWorkflow, /pnpm run check/);
  assert.match(prepareReleaseWorkflow, /pnpm run release:check/);
  assert.match(
    prepareReleaseWorkflow,
    /git commit -m "chore\(release\): prepare \$TARGET_VERSION"/,
  );
  assert.match(prepareReleaseWorkflow, /git push --set-upstream origin "\$PREPARE_BRANCH"/);
  assert.match(prepareReleaseWorkflow, /gh pr create/);
  assert.doesNotMatch(
    prepareReleaseWorkflow,
    /id-token: write|npm publish|publish-release\.mjs|gh release create|git tag|Chrome Web Store/,
  );
  assert.doesNotMatch(prepareReleaseWorkflow, /git push [^\n]*(?:main|\$DEFAULT_BRANCH)/);
  assert.match(releaseWorkflow, /node scripts\/publish-release\.mjs/);
  assert.match(releaseWorkflow, /environment: release/);
});

test('keeps every publishable package license aligned with the repository license', () => {
  for (const definition of PACKAGE_DEFINITIONS) {
    assert.equal(
      readFileSync(new URL(`../${definition.directory}/LICENSE`, import.meta.url), 'utf8'),
      rootLicense,
    );
  }
});

test('accepts one lockstep release identity and rejects version drift', () => {
  const fixture = releaseFixture();
  assert.doesNotThrow(() => validateReleaseMetadata(fixture));
  fixture.packageManifests[2].version = '0.1.1';
  assert.throws(() => validateReleaseMetadata(fixture), /not lockstep/);
});

test('validates stable and beta release identities', () => {
  assert.equal(
    validateReleaseIdentity({
      channel: 'stable',
      extensionVersion: '0.1.0.2',
      version: '0.1.0',
    }),
    'stable',
  );
  assert.equal(
    validateReleaseIdentity({
      channel: 'beta',
      extensionVersion: '0.1.42.3',
      version: '0.1.0-beta.42',
    }),
    'beta',
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        channel: 'beta',
        extensionVersion: '0.1.41.2',
        version: '0.1.0-beta.42',
      }),
    /Beta Chrome version must match 0\.1\.42\.<run-attempt>/,
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        channel: 'nightly',
        extensionVersion: '0.1.0.2',
        version: '0.1.0',
      }),
    /Unsupported release channel/,
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        channel: 'beta',
        extensionVersion: '0.1.65536.1',
        version: '0.1.0-beta.65536',
      }),
    /must not exceed 65535/,
  );
  assert.throws(
    () =>
      validateReleaseIdentity({
        channel: 'beta',
        extensionVersion: '0.1.1.1',
        version: '0.1.0-beta.01',
      }),
    /must match/,
  );
});

test('rejects stale prerelease metadata, identity drift, missing evidence, and invalid SDK metadata', () => {
  const alpha = releaseFixture();
  alpha.descriptor.version = '0.1.0-alpha.1';
  assert.throws(() => validateReleaseMetadata(alpha), /without prerelease metadata/);

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

  const bundledClaude = releaseFixture();
  bundledClaude.packageManifests.find(
    manifest => manifest.name === '@panerelay/bridge',
  ).dependencies['@anthropic-ai/claude-agent-sdk'] = '^0.3.220';
  assert.throws(() => validateReleaseMetadata(bundledClaude), /must not package/);

  const optionalClaude = releaseFixture();
  optionalClaude.packageManifests.find(
    manifest => manifest.name === '@panerelay/bridge',
  ).optionalDependencies = {
    '@anthropic-ai/claude-agent-sdk': '^0.3.220',
  };
  assert.throws(() => validateReleaseMetadata(optionalClaude), /must not package/);
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

test('accepts an external-Claude bridge tarball and rejects a bundled Claude SDK dependency', () => {
  const requiredEntries = [
    'package/dist/claude-cli.js',
    'package/dist/claude-provider.js',
    'package/package.json',
  ];
  const manifest = {
    name: '@panerelay/bridge',
    version: '0.1.0',
    publishConfig: { access: 'public' },
    dependencies: { '@agentclientprotocol/sdk': '^1.3.0' },
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

  const bundled = {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      '@anthropic-ai/claude-agent-sdk': '^0.3.220',
    },
  };
  assert.throws(
    () =>
      validatePackedPackage({
        entries: requiredEntries,
        manifest: bundled,
        manifestText: JSON.stringify(bundled),
        name: bundled.name,
        requiredEntries,
        version: bundled.version,
      }),
    /must not package/,
  );

  const optional = {
    ...manifest,
    optionalDependencies: {
      '@anthropic-ai/claude-agent-sdk': '^0.3.220',
    },
  };
  assert.throws(
    () =>
      validatePackedPackage({
        entries: requiredEntries,
        manifest: optional,
        manifestText: JSON.stringify(optional),
        name: optional.name,
        requiredEntries,
        version: optional.version,
      }),
    /must not package/,
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
