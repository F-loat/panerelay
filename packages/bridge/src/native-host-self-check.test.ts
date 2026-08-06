import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';

test('the bundled Native Host reports its embedded release without starting services', () => {
  const bundlePath = fileURLToPath(new URL('./native-host.bundle.cjs', import.meta.url));
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageManifest = JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string };
  const result = spawnSync(process.execPath, [bundlePath, '--self-check'], {
    encoding: 'utf8',
    timeout: 5_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    protocol: PANERELAY_PROTOCOL_VERSION,
    release: packageManifest.version,
  });
});
