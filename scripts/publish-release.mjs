#!/usr/bin/env node

import { resolve } from 'node:path';
import { loadCandidatePublication, publishCandidate } from './publish-release-lib.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const directory = option('--candidate-directory');
if (!directory) {
  throw new Error('Usage: publish-release.mjs --candidate-directory <path> [--dry-run]');
}
const candidateDirectory = resolve(directory);
const dryRun = process.argv.includes('--dry-run');
const publication = dryRun
  ? await loadCandidatePublication({ candidateDirectory })
  : await publishCandidate({ candidateDirectory });

for (const candidate of publication.packages) {
  console.log(
    `${candidate.state === 'missing' ? 'PUBLISH' : 'SKIP'} ${candidate.name}@${publication.inventory.version} (${publication.tag})`,
  );
}
