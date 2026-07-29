#!/usr/bin/env node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseCandidate, readJson } from './release-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const retain = process.argv.includes('--retain');
const descriptor = await readJson(join(root, 'release.config.json'));
const temporaryDirectory = retain
  ? undefined
  : await mkdtemp(join(tmpdir(), 'panerelay-release-check-'));
const outputDirectory =
  temporaryDirectory ?? join(root, '.artifacts', `panerelay-${descriptor.version}`);

if (retain) {
  await rm(outputDirectory, { force: true, recursive: true });
}

try {
  const inventory = await createReleaseCandidate({ outputDirectory, root });
  console.log(`PaneRelay ${inventory.version} candidate verified.`);
  if (retain) console.log(`Artifacts: ${outputDirectory}`);
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
