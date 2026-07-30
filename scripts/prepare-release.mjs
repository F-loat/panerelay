#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareNextReleaseMetadata } from './prepare-release-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

const increment = option('--increment') ?? 'minor';
const identity = await prepareNextReleaseMetadata({ increment, root });
const githubOutput = option('--github-output');
if (githubOutput) {
  await appendFile(
    githubOutput,
    [
      `base_version=${identity.baseVersion}`,
      `branch=${identity.branch}`,
      `extension_version=${identity.extensionVersion}`,
      `version=${identity.version}`,
      '',
    ].join('\n'),
  );
}

console.log(
  `Prepared Panerelay ${identity.version} metadata from ${identity.baseVersion} (${identity.increment}).`,
);
console.log(`Branch: ${identity.branch}`);
