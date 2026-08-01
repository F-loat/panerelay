import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  readCliAdapterMode,
  readCliAdapterPreferences,
  removeCliAdapterMode,
  setCliAdapterMode,
} from './adapter-preferences.js';

test('stores independent adapter modes in a protected Panerelay-owned file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-preferences-'));
  const preferencesPath = join(directory, 'state', 'preferences.json');
  const options = { preferencesPath };
  try {
    assert.equal(await readCliAdapterMode('browser-use', options), null);
    await setCliAdapterMode('browser-use', 'extension', options);
    await setCliAdapterMode('another-engine', 'direct', options);
    assert.equal(await readCliAdapterMode('browser-use', options), 'extension');
    assert.deepEqual((await readCliAdapterPreferences(options)).modes, {
      'another-engine': 'direct',
      'browser-use': 'extension',
    });
    await removeCliAdapterMode('browser-use', options);
    await removeCliAdapterMode('browser-use', options);
    assert.deepEqual((await readCliAdapterPreferences(options)).modes, {
      'another-engine': 'direct',
    });
    assert.match(await readFile(preferencesPath, 'utf8'), /panerelay\.cli-adapter-preferences\.v1/);

    if (process.platform !== 'win32') {
      await chmod(preferencesPath, 0o644);
      await assert.rejects(
        readCliAdapterPreferences(options),
        /preferences permissions are too broad/,
      );
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('rejects invalid adapter preference keys and modes', async () => {
  await assert.rejects(readCliAdapterMode('../adapter'), /adapter ID is invalid/);
  await assert.rejects(
    setCliAdapterMode('browser-use', 'other' as 'direct'),
    /adapter mode is invalid/,
  );
});
