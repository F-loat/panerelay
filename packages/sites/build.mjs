import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isFetchAdapterManifest } from '@panerelay/protocol';
import { build } from 'esbuild';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const catalogPackage = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
const { createBilibiliManifest } = await import(
  pathToFileURL(join(packageDirectory, 'dist', 'bilibili', 'manifest.js')).href
);
const bilibiliManifest = createBilibiliManifest(catalogPackage.version);
if (!isFetchAdapterManifest(bilibiliManifest)) {
  throw new Error('The generated Bilibili adapter manifest is invalid');
}

const outputDirectory = join(packageDirectory, 'dist', 'adapters', 'bilibili');
await mkdir(outputDirectory, { recursive: true });
await build({
  absWorkingDir: packageDirectory,
  bundle: true,
  entryPoints: {
    adapter: 'src/bilibili/index.ts',
  },
  format: 'esm',
  legalComments: 'none',
  outdir: outputDirectory,
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node20',
});
await writeFile(
  join(outputDirectory, 'panerelay-fetch-adapter.json'),
  `${JSON.stringify(bilibiliManifest, null, 2)}\n`,
  'utf8',
);
await chmod(join(outputDirectory, 'adapter.mjs'), 0o600);
