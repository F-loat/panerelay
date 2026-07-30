#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareNextMinorReleaseMetadata } from './prepare-release-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const identity = await prepareNextMinorReleaseMetadata({ root });
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

console.log(`Prepared Panerelay ${identity.version} metadata from ${identity.baseVersion}.`);
console.log(`Branch: ${identity.branch}`);
