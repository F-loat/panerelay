import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(packageDirectory, 'dist', 'private', 'browser-use');

await rm(outputDirectory, { force: true, recursive: true });
await build({
  absWorkingDir: packageDirectory,
  bundle: true,
  entryPoints: {
    'panerelay-browser-use-adapter': '../browser-use/src/index.ts',
  },
  format: 'esm',
  legalComments: 'none',
  outdir: outputDirectory,
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node20',
});

const playwrightOutputDirectory = join(packageDirectory, 'dist', 'private', 'playwright');
await rm(playwrightOutputDirectory, { force: true, recursive: true });
await build({
  absWorkingDir: packageDirectory,
  bundle: true,
  entryPoints: {
    'panerelay-playwright-adapter': '../playwright/src/index.ts',
  },
  format: 'esm',
  legalComments: 'none',
  outdir: playwrightOutputDirectory,
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node20',
});
