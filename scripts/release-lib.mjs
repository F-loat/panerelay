import { spawn } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, posix, resolve } from 'node:path';

export const PACKAGE_DEFINITIONS = [
  {
    directory: 'packages/protocol',
    name: '@panerelay/protocol',
    requiredEntries: [
      'package/LICENSE',
      'package/README.md',
      'package/dist/index.d.ts',
      'package/dist/index.js',
      'package/dist/node.js',
      'package/package.json',
    ],
  },
  {
    directory: 'packages/agent-browser',
    name: '@panerelay/agent-browser',
    requiredEntries: [
      'package/LICENSE',
      'package/README.md',
      'package/dist/index.js',
      'package/dist/plugin.d.ts',
      'package/dist/plugin.js',
      'package/package.json',
    ],
  },
  {
    directory: 'packages/bridge',
    name: '@panerelay/bridge',
    requiredEntries: [
      'package/LICENSE',
      'package/README.md',
      'package/dist/host-installation.d.ts',
      'package/dist/host-installation.js',
      'package/dist/install.js',
      'package/dist/claude-cli.js',
      'package/dist/claude-provider.js',
      'package/dist/native-host.bundle.cjs',
      'package/dist/platform.js',
      'package/dist/qoder-executable.js',
      'package/dist/qoder-provider.js',
      'package/package.json',
    ],
  },
  {
    directory: 'packages/setup',
    name: '@panerelay/setup',
    requiredEntries: [
      'package/LICENSE',
      'package/README.md',
      'package/dist/cli.js',
      'package/dist/index.d.ts',
      'package/dist/index.js',
      'package/package.json',
      'package/skills/panerelay-browser/SKILL.md',
      'package/skills/panerelay-browser/agents/openai.yaml',
    ],
  },
];

const OFFICIAL_EXTENSION_ID = 'panplnkjlkoceaonlmpdekjphgmbggmi';
const AGENT_BROWSER_MINIMUM_VERSION = '0.33.0';
const CLAUDE_CODE_MINIMUM_VERSION = '2.1.0';
const ACP_SDK_MINIMUM_VERSION = '1.2.1';
const CLAUDE_AGENT_SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk';
const CHROME_EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const NUMERIC_IDENTIFIER = '(0|[1-9]\\d*)';
const SEMVER_PATTERN = new RegExp(
  `^${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}$`,
);
const BETA_SEMVER_PATTERN = new RegExp(
  `^${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}-beta\\.${NUMERIC_IDENTIFIER}$`,
);
const CHROME_VERSION_PATTERN = new RegExp(
  `^${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}$`,
);
const CHROME_VERSION_COMPONENT_MAXIMUM = 65535;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeExtensionEntry(value, owner) {
  invariant(typeof value === 'string' && value.length > 0, `${owner} has an invalid path`);
  const entry = posix.normalize(value.replace(/^\/+/, '').split(/[?#]/, 1)[0]);
  invariant(
    entry !== '.' && entry !== '..' && !entry.startsWith('../') && !posix.isAbsolute(entry),
    `${owner} references a path outside the Extension: ${value}`,
  );
  return entry;
}

function addIconEntries(entries, icons, owner) {
  if (typeof icons === 'string') {
    entries.add(normalizeExtensionEntry(icons, owner));
    return;
  }
  if (!icons || typeof icons !== 'object') return;
  for (const value of Object.values(icons)) {
    entries.add(normalizeExtensionEntry(value, owner));
  }
}

export function requiredExtensionManifestEntries(manifest) {
  const entries = new Set(['manifest.json']);
  if (manifest.background?.service_worker) {
    entries.add(
      normalizeExtensionEntry(manifest.background.service_worker, 'Extension background'),
    );
  }
  if (manifest.side_panel?.default_path) {
    entries.add(normalizeExtensionEntry(manifest.side_panel.default_path, 'Extension side panel'));
  }
  for (const [owner, value] of [
    ['Extension action popup', manifest.action?.default_popup],
    ['Extension options page', manifest.options_page],
    ['Extension options UI', manifest.options_ui?.page],
    ['Extension DevTools page', manifest.devtools_page],
  ]) {
    if (value) entries.add(normalizeExtensionEntry(value, owner));
  }
  addIconEntries(entries, manifest.icons, 'Extension icon');
  addIconEntries(entries, manifest.action?.default_icon, 'Extension action icon');
  for (const [index, contentScript] of (manifest.content_scripts ?? []).entries()) {
    for (const value of [...(contentScript.js ?? []), ...(contentScript.css ?? [])]) {
      entries.add(normalizeExtensionEntry(value, `Extension content script ${index}`));
    }
  }
  for (const [index, resourceGroup] of (manifest.web_accessible_resources ?? []).entries()) {
    for (const value of resourceGroup.resources ?? []) {
      if (value.includes('*')) continue;
      entries.add(normalizeExtensionEntry(value, `Extension web resource ${index}`));
    }
  }
  return [...entries].sort();
}

export function requiredExtensionHtmlEntries(htmlPath, source) {
  const entries = new Set();
  const pattern = /\b(?:href|src)=["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const value = match[1];
    if (
      !value ||
      value.startsWith('#') ||
      value.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(value)
    ) {
      continue;
    }
    const relative = value.startsWith('/') ? value : posix.join(posix.dirname(htmlPath), value);
    entries.add(normalizeExtensionEntry(relative, htmlPath));
  }
  return [...entries].sort();
}

export function validateExtensionEntries(entries, requiredEntries, label = 'Extension build') {
  const available = entries instanceof Set ? entries : new Set(entries);
  for (const entry of requiredEntries) {
    invariant(available.has(entry), `${label} is missing ${entry}`);
  }
}

async function listExtensionEntries(directory, prefix = '') {
  const entries = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? posix.join(prefix, item.name) : item.name;
    if (item.isDirectory()) {
      entries.push(...(await listExtensionEntries(join(directory, item.name), relative)));
    } else if (item.isFile()) {
      entries.push(relative);
    }
  }
  return entries;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function commandInvocation(
  command,
  args,
  { environment = process.env, platform = process.platform } = {},
) {
  if (platform !== 'win32' || (command !== 'npm' && command !== 'pnpm')) {
    return { args, command };
  }
  return {
    args: ['/d', '/c', `${command}.cmd`, ...args],
    command: environment.ComSpec ?? environment.COMSPEC ?? 'cmd.exe',
  };
}

export function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const invocation = commandInvocation(command, args, {
      environment: options.env ?? process.env,
    });
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (options.echo) process.stdout.write(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      if (options.echo) process.stderr.write(chunk);
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) {
        resolvePromise({ stderr, stdout });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`.trim(),
        ),
      );
    });
  });
}

function publicPackageMap(packageManifests) {
  return new Map(packageManifests.map(manifest => [manifest.name, manifest]));
}

function compareVersions(left, right) {
  const leftMatch = SEMVER_PATTERN.exec(left);
  const rightMatch = SEMVER_PATTERN.exec(right);
  invariant(leftMatch && rightMatch, `Invalid semantic version comparison: ${left}, ${right}`);
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function validateReleaseIdentity(descriptor) {
  const channel = descriptor.channel ?? 'stable';
  invariant(channel === 'stable' || channel === 'beta', `Unsupported release channel: ${channel}`);
  const chromeMatch = CHROME_VERSION_PATTERN.exec(descriptor.extensionVersion);
  invariant(chromeMatch, 'Chrome release version must contain four numeric components');
  invariant(
    chromeMatch.slice(1).every(component => Number(component) <= CHROME_VERSION_COMPONENT_MAXIMUM),
    `Chrome release version components must not exceed ${CHROME_VERSION_COMPONENT_MAXIMUM}`,
  );

  if (channel === 'stable') {
    invariant(
      SEMVER_PATTERN.test(descriptor.version),
      'Stable release version must be a plain semantic version without prerelease metadata',
    );
    return channel;
  }

  const betaMatch = BETA_SEMVER_PATTERN.exec(descriptor.version);
  invariant(betaMatch, 'Beta release version must match X.Y.Z-beta.<run-number>');
  const expectedExtensionPrefix = `${betaMatch[1]}.${betaMatch[2]}.${betaMatch[4]}.`;
  invariant(
    descriptor.extensionVersion.startsWith(expectedExtensionPrefix) && Number(chromeMatch[4]) >= 1,
    `Beta Chrome version must match ${expectedExtensionPrefix}<run-attempt>`,
  );
  return channel;
}

export function chromeExtensionIdFromPublicKey(key) {
  invariant(typeof key === 'string' && key.length > 0, 'Extension manifest public key is missing');
  const der = Buffer.from(key, 'base64');
  invariant(der.length > 0, 'Extension manifest public key is invalid');
  createPublicKey({ key: der, format: 'der', type: 'spki' });
  return [...createHash('sha256').update(der).digest().subarray(0, 16)]
    .flatMap(byte => [byte >> 4, byte & 0x0f])
    .map(nibble => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}

export function validateReleaseMetadata({
  compatibilityRecords,
  descriptor,
  extensionManifest,
  extensionPackage,
  implementationSources,
  packageManifests,
  rootPackage,
}) {
  validateReleaseIdentity(descriptor);
  invariant(
    descriptor.version === rootPackage.version,
    'Root version does not match release config',
  );
  invariant(rootPackage.private === true, 'Workspace root must remain private');
  invariant(
    extensionPackage.version === descriptor.version,
    'Extension package version does not match release config',
  );
  invariant(extensionPackage.private === true, 'Extension package must remain private');
  invariant(
    extensionManifest.version === descriptor.extensionVersion,
    'Chrome numeric version does not match release config',
  );
  invariant(
    extensionManifest.version_name === descriptor.version,
    'Extension version_name does not match release config',
  );
  invariant(
    CHROME_EXTENSION_ID_PATTERN.test(descriptor.extensionId),
    'Release config has an invalid official Extension ID',
  );
  invariant(
    descriptor.extensionId === OFFICIAL_EXTENSION_ID,
    'Release config does not contain the official Extension ID',
  );
  invariant(
    chromeExtensionIdFromPublicKey(extensionManifest.key) === descriptor.extensionId,
    'Extension public key does not derive the official Extension ID',
  );
  invariant(
    descriptor.agentBrowserMinimumVersion === AGENT_BROWSER_MINIMUM_VERSION,
    `The minimum agent-browser version must be ${AGENT_BROWSER_MINIMUM_VERSION}`,
  );
  invariant(
    Array.isArray(descriptor.agentBrowserVerifiedVersions) &&
      descriptor.agentBrowserVerifiedVersions.length > 0,
    'Release config must list verified agent-browser versions',
  );
  const verifiedVersions = new Set(descriptor.agentBrowserVerifiedVersions);
  invariant(
    verifiedVersions.size === descriptor.agentBrowserVerifiedVersions.length,
    'Verified agent-browser versions must be unique',
  );
  invariant(
    verifiedVersions.has(descriptor.agentBrowserMinimumVersion),
    'The minimum agent-browser version must have an explicit compatibility record',
  );
  for (const version of verifiedVersions) {
    invariant(
      compareVersions(version, descriptor.agentBrowserMinimumVersion) >= 0,
      `Verified agent-browser ${version} is below the supported minimum`,
    );
    invariant(
      compatibilityRecords?.includes(`agent-browser-${version}.md`),
      `Missing compatibility record for agent-browser ${version}`,
    );
  }
  invariant(
    descriptor.claudeCodeMinimumVersion === CLAUDE_CODE_MINIMUM_VERSION,
    `The minimum Claude Code version must be ${CLAUDE_CODE_MINIMUM_VERSION}`,
  );

  const manifests = publicPackageMap(packageManifests);
  invariant(
    descriptor.packages.length === PACKAGE_DEFINITIONS.length &&
      descriptor.packages.every(name => manifests.has(name)),
    'Release config package list does not match the publishable package set',
  );

  for (const name of descriptor.packages) {
    const manifest = manifests.get(name);
    invariant(manifest.version === descriptor.version, `${name} version is not lockstep`);
    invariant(manifest.private !== true, `${name} must be public-packable`);
    invariant(
      manifest.publishConfig?.access === 'public',
      `${name} must publish with public access`,
    );
    invariant(manifest.license === 'MIT', `${name} must declare the MIT license`);
    invariant(manifest.engines?.node === '>=20', `${name} must require Node.js 20 or newer`);
    invariant(
      manifest.repository?.url === rootPackage.repository?.url,
      `${name} repository metadata is incomplete`,
    );
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
      if (!descriptor.packages.includes(dependency)) continue;
      invariant(
        range === 'workspace:*',
        `${name} must use workspace:* for ${dependency} in source`,
      );
    }
  }

  const bridgeManifest = manifests.get('@panerelay/bridge');
  const acpRange = bridgeManifest?.dependencies?.['@agentclientprotocol/sdk'];
  const acpVersion = typeof acpRange === 'string' ? /^\^(\d+\.\d+\.\d+)$/.exec(acpRange)?.[1] : '';
  invariant(
    acpVersion && compareVersions(acpVersion, ACP_SDK_MINIMUM_VERSION) >= 0,
    `@panerelay/bridge must package @agentclientprotocol/sdk ${ACP_SDK_MINIMUM_VERSION} or newer`,
  );
  invariant(
    !bridgeManifest?.dependencies?.[CLAUDE_AGENT_SDK_PACKAGE],
    `@panerelay/bridge must not package ${CLAUDE_AGENT_SDK_PACKAGE}`,
  );
  invariant(
    implementationSources?.bridgeCompatibility.includes(
      `CLAUDE_CODE_MINIMUM_VERSION = '${descriptor.claudeCodeMinimumVersion}'`,
    ),
    'Bridge Claude Code compatibility floor does not match the release descriptor',
  );

  invariant(
    implementationSources?.protocolConstants.includes(
      `PANERELAY_EXTENSION_ID = '${descriptor.extensionId}'`,
    ),
    'Shared default Extension ID does not match the release descriptor',
  );
  invariant(
    implementationSources?.extensionBackground.includes('extensionId: chrome.runtime.id'),
    'Extension registration does not include the actual Chrome runtime ID',
  );
  invariant(
    implementationSources?.browserRelay.includes(
      'message.extensionId !== this.options.expectedExtensionId',
    ),
    'Bridge registration does not reject an unexpected Extension ID',
  );
  invariant(
    implementationSources?.hostInstallation.includes(
      'allowed_origins: [`chrome-extension://${extensionId}/`]',
    ) &&
      implementationSources.hostInstallation.includes('setlocal DisableDelayedExpansion') &&
      implementationSources.hostInstallation.includes("'reg.exe'"),
    'Native Host installation is missing effective-origin or Windows launcher support',
  );
  invariant(
    implementationSources?.qoderProvider.includes("['--acp']"),
    'Qoder ACP process support is missing from the Bridge',
  );
}

function exportedPaths(value, paths = []) {
  if (typeof value === 'string') {
    paths.push(value);
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const nested of Object.values(value)) exportedPaths(nested, paths);
  return paths;
}

export function validatePackedPackage({
  entries,
  manifest,
  manifestText,
  name,
  requiredEntries,
  version,
}) {
  invariant(manifest.name === name, `${name} tarball has the wrong package name`);
  invariant(manifest.version === version, `${name} tarball has the wrong version`);
  invariant(manifest.private !== true, `${name} tarball is unexpectedly private`);
  invariant(!manifestText.includes('workspace:'), `${name} tarball retains a workspace reference`);
  invariant(manifest.publishConfig?.access === 'public', `${name} tarball is not public`);
  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (!dependency.startsWith('@panerelay/')) continue;
    invariant(range === version, `${name} does not pin ${dependency} to ${version}`);
  }
  for (const entry of requiredEntries) {
    invariant(entries.includes(entry), `${name} tarball is missing ${entry}`);
  }
  invariant(
    entries.every(entry => !entry.includes('.test.')),
    `${name} tarball contains compiled test files`,
  );
  invariant(
    entries.every(
      entry => !/(?:^|\/)(?:private[-_.]?key[^/]*|[^/]+\.(?:pem|p12|pfx|crx))$/i.test(entry),
    ),
    `${name} tarball contains private signing material`,
  );
  if (name === '@panerelay/bridge') {
    const acpRange = manifest.dependencies?.['@agentclientprotocol/sdk'];
    const acpVersion =
      typeof acpRange === 'string' ? /^\^(\d+\.\d+\.\d+)$/.exec(acpRange)?.[1] : '';
    invariant(
      acpVersion && compareVersions(acpVersion, ACP_SDK_MINIMUM_VERSION) >= 0,
      `${name} tarball does not package a supported ACP SDK`,
    );
    invariant(
      !manifest.dependencies?.[CLAUDE_AGENT_SDK_PACKAGE],
      `${name} tarball must not package ${CLAUDE_AGENT_SDK_PACKAGE}`,
    );
  }
  for (const path of [
    ...exportedPaths(manifest.exports),
    ...Object.values(manifest.bin ?? {}).filter(value => typeof value === 'string'),
  ]) {
    const entry = `package/${path.replace(/^\.\//, '')}`;
    invariant(entries.includes(entry), `${name} tarball is missing exported file ${entry}`);
  }
}

export function commandOutputLines(output) {
  return output.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
}

async function sha256(path) {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}

async function artifactRecord(path, type) {
  const details = await stat(path);
  return {
    file: basename(path),
    type,
    bytes: details.size,
    sha256: await sha256(path),
  };
}

async function packPackage(root, outputDirectory, definition, version) {
  const before = new Set((await readdir(outputDirectory)).filter(file => file.endsWith('.tgz')));
  await run(
    'pnpm',
    ['--dir', definition.directory, 'pack', '--pack-destination', outputDirectory],
    { cwd: root },
  );
  const created = (await readdir(outputDirectory)).filter(
    file => file.endsWith('.tgz') && !before.has(file),
  );
  invariant(created.length === 1, `Expected one tarball for ${definition.name}`);
  const tarball = join(outputDirectory, created[0]);
  const entries = commandOutputLines((await run('tar', ['-tzf', tarball])).stdout);
  const manifestText = (await run('tar', ['-xOf', tarball, 'package/package.json'])).stdout;
  const manifest = JSON.parse(manifestText);
  validatePackedPackage({
    entries,
    manifest,
    manifestText,
    name: definition.name,
    requiredEntries: definition.requiredEntries,
    version,
  });
  return { manifest, name: definition.name, path: tarball };
}

async function createExtensionArchive(root, outputDirectory, descriptor) {
  const extensionDirectory = join(root, 'apps/extension/dist');
  const manifest = await readJson(join(extensionDirectory, 'manifest.json'));
  const entries = new Set(await listExtensionEntries(extensionDirectory));
  const requiredEntries = new Set(requiredExtensionManifestEntries(manifest));
  validateExtensionEntries(entries, requiredEntries);
  for (const htmlPath of [...requiredEntries].filter(entry => entry.endsWith('.html'))) {
    const source = await readFile(join(extensionDirectory, htmlPath), 'utf8');
    for (const entry of requiredExtensionHtmlEntries(htmlPath, source)) {
      requiredEntries.add(entry);
    }
  }
  validateExtensionEntries(entries, requiredEntries);
  invariant(
    manifest.version === descriptor.extensionVersion &&
      manifest.version_name === descriptor.version,
    'Built Extension version metadata is not lockstep',
  );
  invariant(
    chromeExtensionIdFromPublicKey(manifest.key) === descriptor.extensionId,
    'Built Extension public key does not derive the official Extension ID',
  );
  const archive = join(outputDirectory, `panerelay-extension-${descriptor.version}.zip`);
  await run('zip', ['-q', '-r', archive, '.', '-x', '*.map'], { cwd: extensionDirectory });
  const archivedEntries = new Set(
    commandOutputLines((await run('unzip', ['-Z1', archive])).stdout),
  );
  validateExtensionEntries(archivedEntries, requiredEntries, 'Extension archive');
  return archive;
}

async function writeStubExecutable(path, output = '') {
  if (process.platform === 'win32') {
    await writeFile(path, `@echo off\r\n${output ? `echo ${output}\r\n` : ''}exit /b 0\r\n`);
    return;
  }
  await writeFile(path, `#!/bin/sh\n${output ? `printf '%s\\n' '${output}'\n` : ''}exit 0\n`);
  await chmod(path, 0o755);
}

async function assertMissing(path, label) {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`${label} remained after packed uninstall: ${path}`);
}

async function packedDoctor(cli, args, options) {
  const result = await run(cli, args, options);
  invariant(
    result.stdout.trim().length > 0,
    `Packed setup doctor produced no JSON${result.stderr ? `: ${result.stderr.trim()}` : ''}`,
  );
  return JSON.parse(result.stdout);
}

export async function smokePackedSetup(tarballs) {
  const smokeRoot = await mkdtemp(join(tmpdir(), 'panerelay release smoke-'));
  const consumerDirectory = join(smokeRoot, 'consumer');
  const homeDirectory = join(smokeRoot, 'home');
  const binDirectory = join(smokeRoot, 'bin');
  try {
    await Promise.all([
      mkdir(consumerDirectory, { recursive: true }),
      mkdir(homeDirectory, { recursive: true }),
      mkdir(binDirectory, { recursive: true }),
    ]);
    const dependencies = Object.fromEntries(
      tarballs.map(tarball => [tarball.name, `file:${resolve(tarball.path)}`]),
    );
    await writeFile(
      join(consumerDirectory, 'package.json'),
      `${JSON.stringify({ name: 'panerelay-release-smoke', private: true, dependencies }, null, 2)}\n`,
    );
    const commandSuffix = process.platform === 'win32' ? '.cmd' : '';
    const codexPath = join(binDirectory, `codex${commandSuffix}`);
    const agentBrowserPath = join(binDirectory, `agent-browser${commandSuffix}`);
    await Promise.all([
      writeStubExecutable(codexPath, 'codex-cli 1.0.0'),
      writeStubExecutable(agentBrowserPath, 'agent-browser 0.33.0'),
    ]);
    const environment = {
      ...process.env,
      HOME: homeDirectory,
      USERPROFILE: homeDirectory,
      PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ''}`,
      PANERELAY_CODEX_PATH: codexPath,
      PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath,
      npm_config_cache: join(smokeRoot, 'npm-cache'),
    };
    await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: consumerDirectory,
      env: environment,
    });
    const cliScript = join(consumerDirectory, 'node_modules/@panerelay/setup/dist/cli.js');
    const cliArguments = args => [cliScript, ...args];
    const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
    await run(process.execPath, cliArguments(['--help']), {
      cwd: consumerDirectory,
      env: environment,
    });
    const setupArgs = ['--project-provider', '--global-provider', '--extension-id', extensionId];
    await run(process.execPath, cliArguments(setupArgs), {
      cwd: consumerDirectory,
      env: environment,
    });
    const doctorArgs = ['doctor', '--project-provider', '--global-provider', '--json'];
    const firstDoctor = await packedDoctor(process.execPath, cliArguments(doctorArgs), {
      cwd: consumerDirectory,
      env: environment,
    });
    invariant(firstDoctor.ok === true, 'Packed setup doctor did not report readiness');
    invariant(
      firstDoctor.checks.some(
        check =>
          check.id === 'extension-id' && check.status === 'pass' && check.detail === extensionId,
      ),
      'Packed setup doctor did not preserve the custom Extension ID',
    );
    await run(
      process.execPath,
      cliArguments(['update', '--project-provider', '--global-provider']),
      {
        cwd: consumerDirectory,
        env: environment,
      },
    );
    const updatedDoctor = await packedDoctor(process.execPath, cliArguments(doctorArgs), {
      cwd: consumerDirectory,
      env: environment,
    });
    invariant(updatedDoctor.ok === true, 'Packed setup update did not preserve readiness');
    invariant(
      updatedDoctor.checks.some(
        check =>
          check.id === 'extension-id' && check.status === 'pass' && check.detail === extensionId,
      ),
      'Packed setup update replaced the persisted custom Extension ID',
    );
    await run(process.execPath, cliArguments(['uninstall', '--project-provider', '--yes']), {
      cwd: consumerDirectory,
      env: environment,
    });
    await Promise.all([
      assertMissing(join(homeDirectory, '.panerelay/bin/panerelay-native-host.cjs'), 'Native Host'),
      assertMissing(join(homeDirectory, '.agents/skills/panerelay-browser'), 'Global Agent Skill'),
      assertMissing(
        join(consumerDirectory, '.agents/skills/panerelay-browser'),
        'Project Agent Skill',
      ),
    ]);
  } finally {
    await rm(smokeRoot, { force: true, recursive: true });
  }
}

async function validateNoPrivateSigningMaterial(root) {
  const output = await run('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root });
  for (const relativePath of commandOutputLines(output.stdout)) {
    invariant(
      !/(?:^|\/)(?:private[-_.]?key[^/]*|[^/]+\.(?:pem|p12|pfx|crx))$/i.test(relativePath),
      `Repository contains private signing material: ${relativePath}`,
    );
    let source;
    try {
      source = await readFile(join(root, relativePath), 'utf8');
    } catch {
      continue;
    }
    invariant(
      !/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(source),
      `Repository contains private signing material: ${relativePath}`,
    );
  }
}

async function validateStableDistributionSources(root) {
  const distributionFiles = [
    'README.md',
    'README.zh-CN.md',
    'docs/releasing.md',
    'docs/compatibility/agent-browser-0.33.0.md',
    'docs/compatibility/claude-code.md',
    ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/README.md`),
    'packages/setup/skills/panerelay-browser/SKILL.md',
  ];
  for (const relativePath of distributionFiles) {
    const source = await readFile(join(root, relativePath), 'utf8');
    invariant(
      !source.includes('0.1.0-alpha'),
      `Stable distribution guidance retains alpha metadata: ${relativePath}`,
    );
  }
  const rootManifest = await readFile(join(root, 'package.json'), 'utf8');
  invariant(
    !rootManifest.includes('publish:alpha'),
    'Stable release scripts retain the alpha publication command',
  );
}

export async function loadReleaseMetadata(root) {
  const packageManifests = await Promise.all(
    PACKAGE_DEFINITIONS.map(definition =>
      readJson(join(root, definition.directory, 'package.json')),
    ),
  );
  return {
    compatibilityRecords: await readdir(join(root, 'docs/compatibility')),
    descriptor: await readJson(join(root, 'release.config.json')),
    extensionManifest: await readJson(join(root, 'apps/extension/manifest.json')),
    extensionPackage: await readJson(join(root, 'apps/extension/package.json')),
    implementationSources: {
      bridgeCompatibility: await readFile(
        join(root, 'packages/bridge/src/compatibility.ts'),
        'utf8',
      ),
      browserRelay: await readFile(join(root, 'packages/bridge/src/browser-relay.ts'), 'utf8'),
      extensionBackground: await readFile(
        join(root, 'apps/extension/src/background/index.ts'),
        'utf8',
      ),
      hostInstallation: await readFile(
        join(root, 'packages/bridge/src/host-installation.ts'),
        'utf8',
      ),
      protocolConstants: await readFile(join(root, 'packages/protocol/src/constants.ts'), 'utf8'),
      qoderProvider: await readFile(join(root, 'packages/bridge/src/qoder-provider.ts'), 'utf8'),
    },
    packageManifests,
    rootPackage: await readJson(join(root, 'package.json')),
  };
}

export async function createReleaseCandidate({ outputDirectory, root, sourceDirty }) {
  const metadata = await loadReleaseMetadata(root);
  validateReleaseMetadata(metadata);
  await validateNoPrivateSigningMaterial(root);
  await validateStableDistributionSources(root);
  await mkdir(outputDirectory, { recursive: true });
  await run('pnpm', ['run', 'build'], { cwd: root, echo: true });

  const tarballs = [];
  for (const definition of PACKAGE_DEFINITIONS) {
    tarballs.push(
      await packPackage(root, outputDirectory, definition, metadata.descriptor.version),
    );
  }
  const extensionArchive = await createExtensionArchive(root, outputDirectory, metadata.descriptor);
  await smokePackedSetup(tarballs);

  const artifacts = await Promise.all([
    ...tarballs.map(tarball => artifactRecord(tarball.path, 'npm')),
    artifactRecord(extensionArchive, 'extension'),
  ]);
  artifacts.sort((left, right) => left.file.localeCompare(right.file));
  const commit = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const dirty =
    sourceDirty ?? (await run('git', ['status', '--porcelain'], { cwd: root })).stdout.length > 0;
  const inventory = {
    schemaVersion: 2,
    channel: metadata.descriptor.channel ?? 'stable',
    version: metadata.descriptor.version,
    extensionVersion: metadata.descriptor.extensionVersion,
    extensionId: metadata.descriptor.extensionId,
    agentBrowserMinimumVersion: metadata.descriptor.agentBrowserMinimumVersion,
    agentBrowserVerifiedVersions: metadata.descriptor.agentBrowserVerifiedVersions,
    claudeCodeMinimumVersion: metadata.descriptor.claudeCodeMinimumVersion,
    source: { commit, dirty },
    artifacts,
  };
  await writeFile(
    join(outputDirectory, 'inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  await writeFile(
    join(outputDirectory, 'SHA256SUMS'),
    `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.file}`).join('\n')}\n`,
  );
  return inventory;
}

export async function smokePackedConsumer({ root }) {
  const metadata = await loadReleaseMetadata(root);
  validateReleaseMetadata(metadata);
  await validateNoPrivateSigningMaterial(root);
  await validateStableDistributionSources(root);
  const outputDirectory = await mkdtemp(join(tmpdir(), 'panerelay-packed-consumer-'));
  try {
    await run('pnpm', ['run', 'build'], { cwd: root, echo: true });
    const tarballs = [];
    for (const definition of PACKAGE_DEFINITIONS) {
      tarballs.push(
        await packPackage(root, outputDirectory, definition, metadata.descriptor.version),
      );
    }
    await smokePackedSetup(tarballs);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}
