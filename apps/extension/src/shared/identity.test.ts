import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';

function chromeExtensionId(publicKey: string): string {
  const digest = createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest();
  return [...digest.subarray(0, 16)]
    .flatMap(byte => [byte >> 4, byte & 0x0f])
    .map(nibble => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}

test('retains the public manifest key that derives the official Extension ID', async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), 'manifest.json'), 'utf8')) as {
    key?: string;
  };
  assert.equal(typeof manifest.key, 'string');
  assert.equal(chromeExtensionId(manifest.key!), PANERELAY_EXTENSION_ID);
  assert.equal(PANERELAY_EXTENSION_ID, 'panplnkjlkoceaonlmpdekjphgmbggmi');
});
