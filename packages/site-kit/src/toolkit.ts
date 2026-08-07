import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES,
  isFetchAdapterManifest,
  type FetchAdapterManifest,
} from '@panerelay/protocol';
import { build } from 'esbuild';
import { inspectSiteSource, type InspectedSite } from './source.js';

const MANIFEST_FILE = 'panerelay-fetch-adapter.json';
const ADAPTER_FILE = 'adapter.mjs';
const TEST_TIMEOUT_MS = 30_000;
const MAX_TEST_OUTPUT_BYTES = 1024 * 1024;

export interface InspectSiteResult {
  sourceDirectory: string;
  manifest: FetchAdapterManifest;
  commandFiles: string[];
  sourceFiles: string[];
}

export interface BuildSiteOptions {
  outDirectory: string;
  version?: string;
}

export interface BuildSiteResult extends InspectSiteResult {
  outDirectory: string;
  manifestPath: string;
  adapterPath: string;
}

export type CheckSiteResult = InspectSiteResult;

export interface TestSiteResult extends InspectSiteResult {
  testFiles: string[];
  stdout: string;
  stderr: string;
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function publicInspection(site: InspectedSite, manifest = site.manifest): InspectSiteResult {
  return {
    sourceDirectory: site.sourceDirectory,
    manifest,
    commandFiles: site.commands.map(command => command.relativePath),
    sourceFiles: site.sourceFiles.map(path =>
      relative(site.sourceDirectory, path).split(sep).join('/'),
    ),
  };
}

function siteKitAliasPlugin() {
  const definitions = fileURLToPath(new URL('./definitions.js', import.meta.url));
  const runtime = fileURLToPath(new URL('./runtime.js', import.meta.url));
  const protocol = createRequire(import.meta.url).resolve('@panerelay/protocol');
  return {
    name: 'panerelay-site-kit',
    setup(buildApi: import('esbuild').PluginBuild): void {
      buildApi.onResolve({ filter: /^@panerelay\/site-kit$/ }, () => ({ path: definitions }));
      buildApi.onResolve({ filter: /^@panerelay\/site-kit\/runtime$/ }, () => ({ path: runtime }));
      buildApi.onResolve({ filter: /^@panerelay\/protocol$/ }, () => ({ path: protocol }));
      buildApi.onResolve({ filter: /.*/ }, args => {
        if (args.path.startsWith('node:')) return { external: true, path: args.path };
        if (args.path.startsWith('.') || args.path.startsWith('/')) return undefined;
        return { errors: [{ text: `Unsupported package import: ${args.path}` }] };
      });
    },
  } satisfies import('esbuild').Plugin;
}

function generatedEntry(site: InspectedSite): string {
  const imports = site.commands.map(
    (command, index) =>
      `import command${index} from ${JSON.stringify(`./${command.relativePath}`)};`,
  );
  const commands = site.commands.map((_, index) => `command${index}`).join(', ');
  return [
    `import { runSiteAdapter } from '@panerelay/site-kit/runtime';`,
    ...imports,
    `await runSiteAdapter([${commands}]);`,
    '',
  ].join('\n');
}

async function bundleSite(site: InspectedSite): Promise<Uint8Array> {
  const result = await build({
    absWorkingDir: site.sourceDirectory,
    bundle: true,
    format: 'esm',
    legalComments: 'none',
    logLevel: 'silent',
    platform: 'node',
    plugins: [siteKitAliasPlugin()],
    stdin: {
      contents: generatedEntry(site),
      loader: 'ts',
      resolveDir: site.sourceDirectory,
      sourcefile: 'panerelay.generated-entry.ts',
    },
    target: 'node20',
    write: false,
  });
  const output = result.outputFiles?.[0];
  if (!output || result.outputFiles?.length !== 1) throw new Error('site bundle output is invalid');
  if (output.contents.byteLength > PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES) {
    throw new Error('generated adapter exceeds the protocol artifact limit');
  }
  return output.contents;
}

async function existingOutputIsReplaceable(path: string, siteId: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    if (!metadata.isDirectory()) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
  const entries = (await readdir(path)).sort();
  if (entries.length === 0) return true;
  if (entries.join('\0') !== [ADAPTER_FILE, MANIFEST_FILE].sort().join('\0')) return false;
  try {
    const manifest = JSON.parse(await readFile(join(path, MANIFEST_FILE), 'utf8')) as unknown;
    return (
      isFetchAdapterManifest(manifest) && manifest.id === siteId && manifest.entry === ADAPTER_FILE
    );
  } catch {
    return false;
  }
}

async function validateGeneratedOutput(
  path: string,
  expected: FetchAdapterManifest,
): Promise<void> {
  const entries = (await readdir(path)).sort();
  if (entries.join('\0') !== [ADAPTER_FILE, MANIFEST_FILE].sort().join('\0')) {
    throw new Error('site build must contain exactly the adapter entry and manifest');
  }
  const manifestText = await readFile(join(path, MANIFEST_FILE), 'utf8');
  const manifest = JSON.parse(manifestText) as unknown;
  if (!isFetchAdapterManifest(manifest) || JSON.stringify(manifest) !== JSON.stringify(expected)) {
    throw new Error('generated site manifest failed protocol revalidation');
  }
  const adapterMetadata = await stat(join(path, ADAPTER_FILE));
  if (
    !adapterMetadata.isFile() ||
    adapterMetadata.size > PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES
  ) {
    throw new Error('generated site entry failed protocol revalidation');
  }
}

async function replaceOutput(staging: string, output: string, siteId: string): Promise<void> {
  if (!(await existingOutputIsReplaceable(output, siteId))) {
    throw new Error('output directory is not empty or is owned by a different site build');
  }
  const backup = `${output}.backup-${randomUUID()}`;
  let movedExisting = false;
  try {
    try {
      await rename(output, backup);
      movedExisting = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await rename(staging, output);
    if (movedExisting) await rm(backup, { recursive: true });
  } catch (error) {
    if (movedExisting) {
      try {
        await rename(backup, output);
      } catch {
        // Preserve the original failure; the backup path remains available for recovery.
      }
    }
    throw error;
  }
}

export async function inspectSite(sourceDirectory: string): Promise<InspectSiteResult> {
  return publicInspection(await inspectSiteSource(sourceDirectory));
}

export async function buildSite(
  sourceDirectory: string,
  options: BuildSiteOptions,
): Promise<BuildSiteResult> {
  const site = await inspectSiteSource(sourceDirectory);
  const output = resolve(options.outDirectory);
  if (isWithin(site.sourceDirectory, output) || isWithin(output, site.sourceDirectory)) {
    throw new Error('build output must be outside the site source directory');
  }
  const manifest = options.version ? { ...site.manifest, version: options.version } : site.manifest;
  if (!isFetchAdapterManifest(manifest)) throw new Error('version override is invalid');
  const bundle = await bundleSite(site);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const staging = await mkdtemp(join(dirname(output), `.${basename(output)}.panerelay-`));
  try {
    await chmod(staging, 0o700);
    await writeFile(join(staging, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await writeFile(join(staging, ADAPTER_FILE), bundle, { mode: 0o600 });
    await chmod(join(staging, MANIFEST_FILE), 0o600);
    await chmod(join(staging, ADAPTER_FILE), 0o600);
    await validateGeneratedOutput(staging, manifest);
    await replaceOutput(staging, output, manifest.id);
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
  return {
    ...publicInspection(site, manifest),
    outDirectory: output,
    manifestPath: join(output, MANIFEST_FILE),
    adapterPath: join(output, ADAPTER_FILE),
  };
}

export async function checkSite(sourceDirectory: string): Promise<CheckSiteResult> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'panerelay-site-check-'));
  try {
    const result = await buildSite(sourceDirectory, {
      outDirectory: join(temporaryRoot, 'output'),
    });
    return {
      sourceDirectory: result.sourceDirectory,
      manifest: result.manifest,
      commandFiles: result.commandFiles,
      sourceFiles: result.sourceFiles,
    };
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function findTests(root: string, directory = root, depth = 0): Promise<string[]> {
  if (depth > 32) throw new Error('site test path is too deep');
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`${relative(root, path)}: symbolic links are not supported`);
    if (entry.isDirectory()) found.push(...(await findTests(root, path, depth + 1)));
    if (entry.isFile() && entry.name.endsWith('.test.ts')) found.push(path);
    if (found.length > 128) throw new Error('site source exceeds 128 test files');
  }
  return found.sort();
}

async function runBoundedTests(paths: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--test', ...paths], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (error) reject(error);
      else resolvePromise(result);
    };
    const collect = (target: Buffer[], chunk: Buffer | string): void => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      outputBytes += value.length;
      if (outputBytes > MAX_TEST_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish(new Error('site test output exceeded the limit'));
        return;
      }
      target.push(value);
    };
    child.stdout.on('data', chunk => collect(stdout, chunk));
    child.stderr.on('data', chunk => collect(stderr, chunk));
    child.on('error', error => finish(error));
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code === 0) finish();
      else {
        const detail = Buffer.concat(stderr).toString('utf8').trim();
        finish(new Error(`site tests failed (${signal ?? code ?? 'unknown'}): ${detail}`));
      }
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`site tests exceeded ${TEST_TIMEOUT_MS}ms`));
    }, TEST_TIMEOUT_MS);
    timer.unref();
  });
}

export async function testSite(sourceDirectory: string): Promise<TestSiteResult> {
  const site = await inspectSiteSource(sourceDirectory);
  const testFiles = await findTests(site.sourceDirectory);
  if (testFiles.length === 0) {
    return { ...publicInspection(site), testFiles: [], stdout: '', stderr: '' };
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'panerelay-site-test-'));
  try {
    const result = await build({
      absWorkingDir: site.sourceDirectory,
      bundle: true,
      entryPoints: Object.fromEntries(testFiles.map((path, index) => [`test-${index}`, path])),
      format: 'esm',
      legalComments: 'none',
      logLevel: 'silent',
      outdir: temporaryRoot,
      outExtension: { '.js': '.mjs' },
      platform: 'node',
      plugins: [siteKitAliasPlugin()],
      target: 'node20',
    });
    if (result.errors.length > 0) throw new Error('site test bundle failed');
    const compiledTests = (await readdir(temporaryRoot))
      .filter(name => name.endsWith('.mjs'))
      .map(name => join(temporaryRoot, name))
      .sort();
    if (compiledTests.length !== testFiles.length)
      throw new Error('site test output is incomplete');
    const output = await runBoundedTests(compiledTests);
    return {
      ...publicInspection(site),
      testFiles: testFiles.map(path => relative(site.sourceDirectory, path).split(sep).join('/')),
      ...output,
    };
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

function validateSiteId(id: string): void {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
    throw new Error('site id must start with a lowercase letter and contain only a-z, 0-9, or -');
  }
}

export async function initializeSite(directory: string, id: string): Promise<void> {
  validateSiteId(id);
  const target = resolve(directory);
  await mkdir(target, { recursive: true, mode: 0o700 });
  if ((await readdir(target)).length > 0) throw new Error('init target directory must be empty');
  await mkdir(join(target, 'commands'), { mode: 0o700 });
  await writeFile(
    join(target, 'panerelay.site.ts'),
    `import { defineSite } from '@panerelay/site-kit';\n\nexport default defineSite({\n  id: ${JSON.stringify(id)},\n  name: ${JSON.stringify(id)},\n  version: '0.1.0',\n  description: ${JSON.stringify(`${id} commands through Panerelay browser fetch.`)},\n});\n`,
    'utf8',
  );
  await writeFile(
    join(target, 'commands', 'me.ts'),
    `import { defineCommand } from '@panerelay/site-kit';\n\nexport default defineCommand({\n  name: 'me',\n  description: 'Show the current profile.',\n  access: 'read',\n  args: [],\n  output: ['name'],\n  examples: ['panerelay fetch ${id} me'],\n  async run(context) {\n    const response = await context.fetch({\n      url: 'https://example.com/api/me',\n      responseType: 'json',\n      withCookies: true,\n    });\n    return response.body;\n  },\n});\n`,
    'utf8',
  );
  await writeFile(
    join(target, 'README.md'),
    `# ${id}\n\n- Check: \`npx --yes @panerelay/site-kit check .\`\n- Test: \`npx --yes @panerelay/site-kit test .\`\n- Build: \`npx --yes @panerelay/site-kit build . --out ../${id}-adapter\`\n`,
    'utf8',
  );
}
