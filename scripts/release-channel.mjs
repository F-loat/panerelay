#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareReleaseChannel } from './release-channel-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const channel = option('--channel');
if (!channel) throw new Error('Usage: release-channel.mjs --channel <stable|beta>');

const result = await prepareReleaseChannel({
  channel,
  root,
  runAttempt: option('--run-attempt'),
  runNumber: option('--run-number'),
});
const githubOutput = option('--github-output');
if (githubOutput) {
  const outputs = {
    artifact_directory: result.artifactDirectory,
    channel: result.channel,
    extension_archive: result.extensionArchive,
    firefox_extension_archive: result.firefoxExtensionArchive,
    npm_tag: result.npmTag,
    release_tag: result.releaseTag,
    version: result.version,
  };
  await appendFile(
    githubOutput,
    `${Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
  );
}

console.log(`Panerelay ${result.version} ${result.channel} candidate verified.`);
console.log(`Artifacts: ${result.artifactDirectory}`);
