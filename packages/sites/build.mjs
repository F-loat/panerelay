import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '@panerelay/site-kit';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const catalogPackage = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
const outputDirectory = join(packageDirectory, 'dist', 'adapters', 'bilibili');
await buildSite(join(packageDirectory, 'src', 'bilibili'), {
  outDirectory: outputDirectory,
  version: catalogPackage.version,
});
