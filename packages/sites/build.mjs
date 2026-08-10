import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSiteCatalog } from '@panerelay/site-kit';
import { builtinSiteIds } from './dist/index.js';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const catalogPackage = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
await buildSiteCatalog(
  builtinSiteIds().map(siteId => ({
    id: siteId,
    sourceDirectory: join(packageDirectory, 'src', siteId),
  })),
  {
    outDirectory: join(packageDirectory, 'dist', 'adapters'),
    version: catalogPackage.version,
  },
);
