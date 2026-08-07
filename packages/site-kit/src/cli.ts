#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, checkSite, initializeSite, testSite } from './toolkit.js';

const HELP = `Panerelay site adapter toolkit

Usage:
  panerelay-site init <directory> --id <site>
  panerelay-site check <directory>
  panerelay-site test <directory>
  panerelay-site build <directory> --out <directory>

Commands:
  init    Create a minimal command-per-file site adapter
  check   Validate source, types, imports, and generated artifacts
  test    Explicitly run colocated *.test.ts files
  build   Write the strict two-file install source

Options:
  -h, --help     Show help
  -v, --version  Show the package version
`;

function fail(message: string): never {
  throw new Error(message);
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) fail(`${name} requires a value`);
  args.splice(index, 2);
  if (args.includes(name)) fail(`${name} can be specified only once`);
  return value;
}

async function packageVersion(): Promise<string> {
  const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
  const value = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8')) as {
    version?: unknown;
  };
  if (typeof value.version !== 'string') throw new Error('site-kit package version is invalid');
  return value.version;
}

async function main(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write(`v${await packageVersion()}\n`);
    return;
  }
  const [command, ...values] = argv;
  if (values.includes('--help') || values.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  if (!['init', 'check', 'test', 'build'].includes(command ?? '')) {
    fail(`unknown command: ${command ?? ''}`);
  }
  const args = [...values];
  const id = takeOption(args, '--id');
  const out = takeOption(args, '--out');
  if (args.some(value => value.startsWith('-')))
    fail(`unknown option: ${args.find(value => value.startsWith('-'))}`);
  if (args.length !== 1) fail(`${command} requires exactly one source directory`);
  const source = args[0]!;
  if (command === 'init') {
    if (!id) fail('init requires --id <site>');
    if (out) fail('init does not accept --out');
    await initializeSite(source, id);
    process.stdout.write(`Initialized ${id} in ${resolve(source)}\n`);
    return;
  }
  if (id) fail(`${command} does not accept --id`);
  if (command === 'build') {
    if (!out) fail('build requires --out <directory>');
    const result = await buildSite(source, { outDirectory: out });
    process.stdout.write(
      `Built ${result.manifest.id}@${result.manifest.version} to ${result.outDirectory}\n`,
    );
    return;
  }
  if (out) fail(`${command} does not accept --out`);
  if (command === 'check') {
    const result = await checkSite(source);
    process.stdout.write(
      `Checked ${result.manifest.id}: ${result.manifest.commands.length} commands\n`,
    );
    return;
  }
  const result = await testSite(source);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.stdout.write(`Tested ${result.manifest.id}: ${result.testFiles.length} test files\n`);
}

main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`site-kit: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
