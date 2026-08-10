import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PACKAGE_DEFINITIONS,
  commandOutputLines,
  commandInvocation,
  requiredExtensionHtmlEntries,
  requiredExtensionManifestEntries,
  resolveInstalledPlaywrightAdapter,
  validateExtensionEntries,
  validatePackedPackage,
  validateNativeHostSelfCheck,
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
const documentationIndex = readFileSync(new URL('../docs/README.md', import.meta.url), 'utf8');
const documentationIndexZhCn = readFileSync(
  new URL('../docs/README.zh-CN.md', import.meta.url),
  'utf8',
);
const setupReadme = readFileSync(new URL('../packages/setup/README.md', import.meta.url), 'utf8');
const browserUseReadme = readFileSync(
  new URL('../packages/adapters/browser-use/README.md', import.meta.url),
  'utf8',
);
const playwrightReadme = readFileSync(
  new URL('../packages/adapters/playwright/README.md', import.meta.url),
  'utf8',
);
const unifiedSkill = readFileSync(new URL('../skills/panerelay/SKILL.md', import.meta.url), 'utf8');
const setupPackage = JSON.parse(
  readFileSync(new URL('../packages/setup/package.json', import.meta.url), 'utf8'),
);
const cliPackage = JSON.parse(
  readFileSync(new URL('../packages/cli/package.json', import.meta.url), 'utf8'),
);
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
    playwrightCliMinimumVersion: '0.1.17',
    playwrightCliVerifiedVersions: ['0.1.17'],
    claudeCodeMinimumVersion: '2.1.206',
    openCodeVerifiedVersions: ['1.18.12'],
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
            ...(name === '@panerelay/setup'
              ? {
                  '@panerelay/site-kit': 'workspace:*',
                  '@panerelay/sites': 'workspace:*',
                }
              : {}),
            ...(name === '@panerelay/sites'
              ? {
                  '@panerelay/site-kit': 'workspace:*',
                }
              : {}),
            ...(name === '@panerelay/bridge'
              ? {
                  '@agentclientprotocol/sdk': '^1.3.0',
                }
              : {}),
          },
        }),
  }));
  return {
    compatibilityRecords: [
      'agent-browser-0.33.0.md',
      'opencode-1.18.12.md',
      'playwright-cli-0.1.17.md',
    ],
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
      opencodeProvider: "launchArgs: ['acp']",
      qoderProvider: "launchArgs: ['--acp']",
    },
    packageManifests,
    rootPackage: { version, private: true, repository },
  };
}

test('keeps setup executable distinct from the administration CLI', () => {
  assert.deepEqual(setupPackage.bin, { 'panerelay-setup': './dist/cli.js' });
  assert.deepEqual(cliPackage.bin, { panerelay: './dist/cli.js' });
});

test('resolves a packed Playwright adapter from its installed integration version', async () => {
  const home = await mkdtemp(join(tmpdir(), 'panerelay-release-playwright-'));
  const configPath = join(home, '.panerelay/playwright/config.json');
  try {
    await mkdir(join(home, '.panerelay/playwright'), { recursive: true });
    await writeFile(configPath, JSON.stringify({ version: '0.4.0' }));
    assert.deepEqual(await resolveInstalledPlaywrightAdapter(home), {
      path: join(
        home,
        '.panerelay/adapters/playwright/0.4.0/dist/panerelay-playwright-adapter.mjs',
      ),
      version: '0.4.0',
    });

    await writeFile(configPath, JSON.stringify({ version: '../outside' }));
    await assert.rejects(resolveInstalledPlaywrightAdapter(home), /invalid adapter version/);
  } finally {
    await rm(home, { force: true, recursive: true });
  }
});

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
  assert.match(
    releaseWorkflow,
    /source_sha:\n\s+description: Full commit SHA to release\n\s+required: true\n\s+type: string/,
  );
  assert.match(releaseWorkflow, /group: panerelay-release\n\s+cancel-in-progress: false/);
  assert.match(releaseWorkflow, /environment: release/);
  assert.match(releaseWorkflow, /id-token: write/);
  assert.match(releaseWorkflow, /actions\/upload-artifact@v7/g);
  assert.match(releaseWorkflow, /actions\/download-artifact@v8/g);
  assert.match(releaseWorkflow, /node scripts\/publish-release\.mjs/);
  assert.match(releaseWorkflow, /ref: \$\{\{ inputs\.source_sha \}\}/);
  assert.match(releaseWorkflow, /git rev-parse HEAD/);
  assert.match(
    releaseWorkflow,
    /if \[\[ "\$checked_out_sha" != "\$SOURCE_SHA" \]\]; then[\s\S]+exit 1/,
  );
  assert.match(
    releaseWorkflow,
    /git merge-base --is-ancestor "\$checked_out_sha" "origin\/\$DEFAULT_BRANCH"/,
  );
  assert.match(releaseWorkflow, /source_sha=\$checked_out_sha/);
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
  assert.match(
    stableRelease,
    /RELEASE_SOURCE_SHA: \$\{\{ needs\.prepare\.outputs\.source_sha \}\}/,
  );
  assert.match(stableRelease, /--target "\$RELEASE_SOURCE_SHA"/);
  assert.doesNotMatch(stableRelease, /release-assets\/inventory\.json/);
  assert.doesNotMatch(stableRelease, /Includes Codex, Claude Code, and Qoder side-panel Agents\./);
  assert.doesNotMatch(releaseWorkflow, /NPM_TOKEN|git push|git tag/);
});

test('keeps official installation guidance Store-first and version-neutral', () => {
  const englishQuickstart = rootReadme.slice(
    rootReadme.indexOf('## Quickstart'),
    rootReadme.indexOf('## Fetch with browser login state'),
  );
  const chineseQuickstart = rootReadmeZhCn.slice(
    rootReadmeZhCn.indexOf('## 快速开始'),
    rootReadmeZhCn.indexOf('## 使用浏览器登录态 Fetch'),
  );
  const englishFetch = rootReadme.slice(
    rootReadme.indexOf('## Fetch with browser login state'),
    rootReadme.indexOf('## Connect automation tools'),
  );
  const chineseFetch = rootReadmeZhCn.slice(
    rootReadmeZhCn.indexOf('## 使用浏览器登录态 Fetch'),
    rootReadmeZhCn.indexOf('## Connect 自动化工具'),
  );
  const englishAdvanced = rootReadme.slice(
    rootReadme.indexOf('## Advanced management'),
    rootReadme.indexOf('## Development and release checks'),
  );
  const chineseAdvanced = rootReadmeZhCn.slice(
    rootReadmeZhCn.indexOf('## 高级管理'),
    rootReadmeZhCn.indexOf('## 开发与发布检查'),
  );

  for (const guidance of [englishQuickstart, chineseQuickstart]) {
    assert.match(guidance, new RegExp(chromeWebStoreUrl.replaceAll('.', '\\.')));
    assert.match(guidance, /npx skills add F-loat\/panerelay --skill panerelay/);
    assert.doesNotMatch(guidance, /npx --yes @panerelay\/setup/);
    assert.doesNotMatch(guidance, /@panerelay\/setup@\d+\.\d+\.\d+/);
  }
  assert.match(setupReadme, new RegExp(chromeWebStoreUrl.replaceAll('.', '\\.')));
  assert.match(setupReadme, /npx skills add F-loat\/panerelay --skill panerelay/);
  assert.match(setupReadme, /npx --yes @panerelay\/setup/);
  assert.doesNotMatch(englishQuickstart, /Panerelay Releases|chrome:\/\/extensions/);
  assert.doesNotMatch(chineseQuickstart, /Panerelay Releases|chrome:\/\/extensions/);
  assert.match(
    rootReadme,
    /load `apps\/extension\/dist` as an unpacked Extension in Chrome or Edge/,
  );
  assert.match(rootReadmeZhCn, /在 Chrome 或 Edge 中将 `apps\/extension\/dist` 加载为未打包扩展/);
  assert.match(rootReadme, /Browser-authenticated Fetch and existing-browser Connect/);
  assert.match(rootReadmeZhCn, /浏览器登录态 Fetch 和现有浏览器 Connect/);
  assert.match(rootReadme, /\| \*\*Fetch\*\*[\s\S]+\| \*\*Connect\*\*/);
  assert.match(rootReadmeZhCn, /\| \*\*Fetch\*\*[\s\S]+\| \*\*Connect\*\*/);
  assert.match(rootReadme, /## Advanced management[\s\S]+?<details>[\s\S]+?<\/details>/);
  assert.match(rootReadmeZhCn, /## 高级管理[\s\S]+?<details>[\s\S]+?<\/details>/);
  assert.match(
    rootReadme,
    /## FAQ[\s\S]+How is Panerelay different from OpenCLI\?[\s\S]+How is Panerelay different from connecting directly through CDP\?[\s\S]+What are Panerelay's main advantages\?/,
  );
  assert.match(
    rootReadmeZhCn,
    /## 常见问题[\s\S]+Panerelay 和 OpenCLI 有什么区别？[\s\S]+Panerelay 和直接使用 CDP 有什么区别？[\s\S]+Panerelay 的主要优势是什么？/,
  );
  assert.match(
    rootReadme,
    /Fetch does not use CDP[\s\S]+do not depend on an open target tab[\s\S]+debugging banner[\s\S]+bounded concurrency is more stable/,
  );
  assert.match(
    rootReadmeZhCn,
    /Fetch 完全不使用 CDP[\s\S]+不依赖目标站点页面保持打开[\s\S]+不会显示 Chrome 调试横幅[\s\S]+受限并发也更稳定/,
  );
  assert.match(rootReadme, /without a fresh CDP confirmation click for every connection/);
  assert.match(rootReadmeZhCn, /无需每次连接都重新点击 CDP 确认弹窗/);
  assert.match(rootReadme, /Agent's current tab-control state visible/);
  assert.match(rootReadmeZhCn, /Agent 当前的标签页控制状态/);
  for (const readme of [rootReadme, rootReadmeZhCn]) {
    assert.match(readme, /```mermaid\nflowchart LR/);
    assert.match(readme, /npx --yes @panerelay\/setup add --all/);
    assert.match(readme, /https:\/\/github\.com\/jackwener\/OpenCLI/);
  }
  for (const fetchSection of [englishFetch, chineseFetch]) {
    const adapters = fetchSection.indexOf('@panerelay/setup add --all');
    const authorization = fetchSection.indexOf('panerelay fetch --authorize');
    assert.ok(adapters >= 0 && authorization >= 0 && adapters < authorization);
    assert.doesNotMatch(
      fetchSection,
      /panerelay_fetch\.browser_fetch|--codex-fetch|--claude-fetch/,
    );
  }
  for (const advancedSection of [englishAdvanced, chineseAdvanced]) {
    assert.match(advancedSection, /panerelay_fetch\.browser_fetch/);
    assert.match(advancedSection, /--codex-fetch/);
    assert.match(advancedSection, /--claude-fetch/);
  }
  assert.doesNotMatch(rootReadme, /^## (?:Supported workflows|Documentation)$/m);
  assert.doesNotMatch(rootReadmeZhCn, /^## (?:支持的工作流|文档)$/m);
  const sharedImage =
    'https://github.com/user-attachments/assets/2eba77ae-5362-4803-9190-cf134dd2b8d7';
  assert.match(rootReadme, new RegExp(sharedImage.replaceAll('.', '\\.')));
  assert.match(rootReadmeZhCn, new RegExp(sharedImage.replaceAll('.', '\\.')));
  for (const readme of [rootReadme, rootReadmeZhCn]) {
    assert.match(
      readme,
      /BU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use browser-use[\s\S]+print\(list_tabs\(\)\)/,
    );
    assert.doesNotMatch(readme, /panerelay-browser-use-cli/);
    assert.doesNotMatch(readme, /browser-use tab list/);
    assert.match(readme, /packages\/setup\/dist\/cli\.js --agent-browser --global-default/);
    assert.doesNotMatch(readme, /--project-provider|--global-provider/);
  }
  assert.doesNotMatch(browserUseReadme, /browser-use --version/);
  assert.match(
    playwrightReadme,
    /playwright-cli attach --cdp http:\/\/127\.0\.0\.1:43827\/cdp\/playwright/,
  );
  assert.match(playwrightReadme, /does not install a shim[\s\S]+set Playwright as a default/i);
  assert.match(rootReadme, /packages\/setup\/dist\/cli\.js --agent-browser --global-default/);
  assert.doesNotMatch(rootReadme, /--project-provider|--global-provider/);
  for (const guidance of [
    rootReadme,
    rootReadmeZhCn,
    setupReadme,
    documentationIndex,
    documentationIndexZhCn,
  ]) {
    assert.doesNotMatch(guidance, /agent-setup\.md|curl -fsSL/);
  }
  assert.match(unifiedSkill, /## agent-browser workflow/);
  assert.match(unifiedSkill, /## Browser Use workflow/);
  assert.match(unifiedSkill, /## Playwright CLI workflow/);
});

test('keeps localized README documentation navigation in the selected language', () => {
  assert.match(rootReadme, /\[Documentation\]\(docs\/README\.md\)/);
  assert.match(rootReadmeZhCn, /\[文档导航\]\(docs\/README\.zh-CN\.md\)/);
  assert.doesNotMatch(rootReadmeZhCn, /\[文档导航\]\(docs\/README\.md\)/);
  assert.match(documentationIndex, /\[简体中文\]\(README\.zh-CN\.md\)/);
  assert.match(documentationIndexZhCn, /\[English\]\(README\.md\)/);
});

test('keeps selectable release preparation validated, auto-squashed, and dispatched', () => {
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
  assert.match(prepareReleaseWorkflow, /actions: write/);
  assert.match(
    prepareReleaseWorkflow,
    /pnpm run release:prepare -- --increment "\$RELEASE_INCREMENT"/,
  );
  assert.match(prepareReleaseWorkflow, /refs\/tags\/\$base_tag/);
  assert.match(prepareReleaseWorkflow, /refs\/heads\/\$PREPARE_BRANCH/);
  assert.match(prepareReleaseWorkflow, /npm view "\$package_name@\$TARGET_VERSION"/);
  const packagePreflight = /for package_name in \\\n([\s\S]*?); do/.exec(prepareReleaseWorkflow);
  assert.ok(packagePreflight);
  assert.deepEqual(
    packagePreflight[1].match(/@panerelay\/[a-z-]+/g),
    PACKAGE_DEFINITIONS.map(definition => definition.name),
  );
  for (const definition of PACKAGE_DEFINITIONS) {
    const manifestPath = `${definition.directory}/package.json`;
    assert.equal(
      prepareReleaseWorkflow.split(manifestPath).length - 1,
      2,
      `${manifestPath} should be checked and committed by release preparation`,
    );
  }
  assert.match(prepareReleaseWorkflow, /pnpm run check/);
  assert.match(prepareReleaseWorkflow, /pnpm run release:check/);
  assert.match(
    prepareReleaseWorkflow,
    /git commit -m "chore\(release\): prepare \$TARGET_VERSION"/,
  );
  assert.match(prepareReleaseWorkflow, /git push --set-upstream origin "\$PREPARE_BRANCH"/);
  assert.match(prepareReleaseWorkflow, /id: commit/);
  assert.match(
    prepareReleaseWorkflow,
    /echo "head_sha=\$\(git rev-parse HEAD\)" >>"\$GITHUB_OUTPUT"/,
  );
  assert.match(prepareReleaseWorkflow, /gh pr create/);
  assert.match(prepareReleaseWorkflow, /id: pr/);
  assert.match(prepareReleaseWorkflow, /echo "url=\$pr_url" >>"\$GITHUB_OUTPUT"/);
  const checkGateStart = prepareReleaseWorkflow.indexOf(
    '      - name: Wait for pull request checks',
  );
  const mergeStepStart = prepareReleaseWorkflow.indexOf(
    '      - name: Squash merge validated pull request',
  );
  assert.ok(checkGateStart >= 0);
  assert.ok(mergeStepStart > checkGateStart);
  const checkGate = prepareReleaseWorkflow.slice(checkGateStart, mergeStepStart);
  assert.match(
    checkGate,
    /expected_checks='\["check \(20\)","check \(22\)","windows-packed-consumer \(20\)","windows-packed-consumer \(22\)"\]'/,
  );
  assert.match(checkGate, /gh pr checks "\$PR_URL"[\s\S]+--json name,state,bucket 2>&1/);
  assert.match(checkGate, /check_status=\$\?/);
  assert.match(checkGate, /grep -qiE 'no checks reported on \.\* branch'/);
  assert.match(checkGate, /echo "\$check_output" >&2/);
  assert.match(checkGate, /exit "\$check_status"/);
  assert.doesNotMatch(checkGate, /2>\/dev\/null\s+\|\|\s+true/);
  assert.match(checkGate, /jq -r --argjson expected "\$expected_checks"/);
  assert.match(checkGate, /checks_ready=true/);
  assert.ok(checkGate.indexOf('checks_ready=true') < checkGate.indexOf('--watch'));
  assert.match(checkGate, /--watch/);
  assert.match(checkGate, /--fail-fast/);
  assert.match(checkGate, /--interval 10/);
  const mergeStep = prepareReleaseWorkflow.slice(mergeStepStart);
  assert.match(mergeStep, /gh pr merge "\$PR_URL"/);
  assert.ok(mergeStep.indexOf('baseRefName') < mergeStep.indexOf('gh pr merge'));
  assert.match(prepareReleaseWorkflow, /--squash/);
  assert.match(prepareReleaseWorkflow, /--delete-branch/);
  assert.match(prepareReleaseWorkflow, /--match-head-commit "\$PREPARE_SHA"/);
  assert.doesNotMatch(prepareReleaseWorkflow, /--admin/);
  assert.match(prepareReleaseWorkflow, /MERGE_DISCOVERY_ATTEMPTS: 60/);
  assert.match(
    prepareReleaseWorkflow,
    /gh api[\s\S]+compare\/\$merged_sha\.\.\.\$DEFAULT_BRANCH[\s\S]+\.status/,
  );
  const mergeDiscoveryStepStart = prepareReleaseWorkflow.indexOf(
    '      - name: Wait for merged version on default branch',
  );
  assert.ok(mergeDiscoveryStepStart > mergeStepStart);
  const mergeDiscoveryStep = prepareReleaseWorkflow.slice(mergeDiscoveryStepStart);
  assert.match(mergeDiscoveryStep, /id: merge/);
  assert.match(mergeDiscoveryStep, /echo "merged_sha=\$merged_sha"/);
  const dispatchStepStart = prepareReleaseWorkflow.indexOf('      - name: Dispatch stable release');
  assert.ok(dispatchStepStart > mergeDiscoveryStepStart);
  const dispatchStep = prepareReleaseWorkflow.slice(dispatchStepStart);
  assert.match(dispatchStep, /gh workflow run release\.yml/);
  assert.match(dispatchStep, /--ref "\$DEFAULT_BRANCH"/);
  assert.match(dispatchStep, /--field channel=stable/);
  assert.match(dispatchStep, /--field source_sha="\$MERGED_SHA"/);
  assert.doesNotMatch(prepareReleaseWorkflow, /run \*\*Release\*\* from/);
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

test('accepts only the exact embedded Native Host release/protocol identity', () => {
  assert.equal(
    validateNativeHostSelfCheck(
      { protocol: 'panerelay.relay.v2', release: '0.8.0-beta.42' },
      '0.8.0-beta.42',
    ),
    '0.8.0-beta.42',
  );
  assert.throws(
    () =>
      validateNativeHostSelfCheck(
        { protocol: 'panerelay.relay.v2', release: '0.8.0-beta.41' },
        '0.8.0-beta.42',
      ),
    /not lockstep/,
  );
  assert.throws(
    () =>
      validateNativeHostSelfCheck(
        { protocol: 'panerelay.relay.v1', release: '0.8.0-beta.42' },
        '0.8.0-beta.42',
      ),
    /not lockstep/,
  );
  assert.throws(
    () =>
      validateNativeHostSelfCheck(
        { command: 'npx evil', protocol: 'panerelay.relay.v2', release: '0.8.0-beta.42' },
        '0.8.0-beta.42',
      ),
    /not lockstep/,
  );
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

  const missingPlaywrightEvidence = releaseFixture();
  missingPlaywrightEvidence.compatibilityRecords = [
    'agent-browser-0.33.0.md',
    'opencode-1.18.12.md',
  ];
  assert.throws(
    () => validateReleaseMetadata(missingPlaywrightEvidence),
    /Missing compatibility record for Playwright CLI 0\.1\.17/,
  );

  const missingOpenCodeEvidence = releaseFixture();
  missingOpenCodeEvidence.compatibilityRecords = [
    'agent-browser-0.33.0.md',
    'playwright-cli-0.1.17.md',
  ];
  assert.throws(
    () => validateReleaseMetadata(missingOpenCodeEvidence),
    /Missing compatibility record for OpenCode 1\.18\.12/,
  );

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

test('sites tarballs contain only exact adapter artifacts and the public entry', () => {
  const entries = [
    'package/dist/adapters/example/adapter.mjs',
    'package/dist/adapters/example/panerelay-fetch-adapter.json',
    'package/dist/index.d.ts',
    'package/dist/index.d.ts.map',
    'package/dist/index.js',
    'package/package.json',
  ];
  const manifest = {
    name: '@panerelay/sites',
    version: '0.1.0',
    publishConfig: { access: 'public' },
  };
  assert.doesNotThrow(() =>
    validatePackedPackage({
      entries,
      manifest,
      manifestText: JSON.stringify(manifest),
      name: manifest.name,
      requiredEntries: entries,
      version: manifest.version,
    }),
  );
  assert.throws(
    () =>
      validatePackedPackage({
        entries: [...entries, 'package/dist/bilibili/client.js'],
        manifest,
        manifestText: JSON.stringify(manifest),
        name: manifest.name,
        requiredEntries: entries,
        version: manifest.version,
      }),
    /redundant site source output/,
  );
  assert.throws(
    () =>
      validatePackedPackage({
        entries: entries.filter(entry => !entry.endsWith('panerelay-fetch-adapter.json')),
        manifest,
        manifestText: JSON.stringify(manifest),
        name: manifest.name,
        requiredEntries: entries.filter(entry => !entry.endsWith('panerelay-fetch-adapter.json')),
        version: manifest.version,
      }),
    /not an exact two-file artifact/,
  );
});

test('accepts an external-Claude bridge tarball and rejects a bundled Claude SDK dependency', () => {
  const requiredEntries = [
    'package/dist/providers/claude-code/cli.js',
    'package/dist/providers/claude-code/provider.js',
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
