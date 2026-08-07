import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function packageManifestPaths(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== 'dist' && entry.name !== 'node_modules') {
        paths.push(...packageManifestPaths(join(directory, entry.name)));
      }
    } else if (entry.name === 'package.json') {
      paths.push(join(directory, entry.name));
    }
  }
  return paths;
}

function publishedExecutables() {
  const executables = [];
  for (const manifestPath of packageManifestPaths(join(repositoryRoot, 'packages'))) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.private === true || !manifest.bin) continue;
    const entries =
      typeof manifest.bin === 'string'
        ? [[manifest.name, manifest.bin]]
        : Object.entries(manifest.bin);
    for (const [name, relativePath] of entries) {
      executables.push({
        name,
        path: resolve(dirname(manifestPath), relativePath),
        version: manifest.version,
      });
    }
  }
  return executables.sort((left, right) => left.name.localeCompare(right.name));
}

function invoke(executable, argument, environment) {
  return spawnSync(process.execPath, [executable.path, argument], {
    encoding: 'utf8',
    env: environment,
    input: '',
    timeout: 5_000,
  });
}

test('every published executable supports the standard help and version aliases', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'panerelay-cli-meta-options-'));
  const isolatedHome = join(fixture, 'home');
  const environment = {
    ...process.env,
    HOME: isolatedHome,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    PANERELAY_LANG: 'en',
    USERPROFILE: isolatedHome,
  };

  try {
    const executables = publishedExecutables();
    const executableNames = executables.map(executable => executable.name);
    assert.deepEqual(executableNames, ['panerelay', 'panerelay-setup', 'panerelay-site']);

    for (const executable of executables) {
      const shortVersion = invoke(executable, '-v', environment);
      const longVersion = invoke(executable, '--version', environment);
      for (const result of [shortVersion, longVersion]) {
        assert.equal(result.error, undefined, `${executable.name}: ${result.error?.message}`);
        assert.equal(result.status, 0, `${executable.name}: ${result.stderr}`);
        assert.equal(result.stderr, '', executable.name);
        assert.equal(result.stdout, `v${executable.version}\n`);
      }
      assert.equal(shortVersion.stdout, longVersion.stdout, executable.name);

      const shortHelp = invoke(executable, '-h', environment);
      const longHelp = invoke(executable, '--help', environment);
      for (const result of [shortHelp, longHelp]) {
        assert.equal(result.error, undefined, `${executable.name}: ${result.error?.message}`);
        assert.equal(result.status, 0, `${executable.name}: ${result.stderr}`);
        assert.equal(result.stderr, '', executable.name);
        assert.match(result.stdout, /Usage:/, executable.name);
        assert.match(result.stdout, /(?:-v, --version|--version, -v)/, executable.name);
        assert.match(result.stdout, /(?:-h, --help|--help, -h)/, executable.name);
      }
      assert.equal(shortHelp.stdout, longHelp.stdout, executable.name);
    }

    assert.equal(existsSync(isolatedHome), false, 'metadata queries changed isolated user state');
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
});
