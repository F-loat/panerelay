import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  browserUseEnvironmentPath,
  PANERELAY_BROWSER_USE_GATEWAY_URL,
  setBrowserUseEnvironmentMode,
} from './environment.js';

test('writes the fixed Browser Use gateway and preserves unrelated environment keys', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-'));
  const homeDirectory = join(root, 'home');
  const path = browserUseEnvironmentPath(homeDirectory);
  try {
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    let content = await readFile(path, 'utf8');
    assert.match(content, new RegExp(`BU_CDP_URL="${PANERELAY_BROWSER_USE_GATEWAY_URL}"`));
    assert.match(content, /BH_TELEMETRY="0"/);
    assert.match(content, /BU_NAME="panerelay"/);
    assert.doesNotMatch(content, /BH_RUNTIME_DIR=/);
    assert.doesNotMatch(content, /BH_TMP_DIR=/);

    await writeFile(
      path,
      `${content}BH_RUNTIME_DIR="/legacy/runtime"\nBH_TMP_DIR="/legacy/tmp"\nCUSTOM_BROWSER_FLAG="keep-me"\n`,
    );
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    content = await readFile(path, 'utf8');
    assert.doesNotMatch(content, /BH_RUNTIME_DIR=/);
    assert.doesNotMatch(content, /BH_TMP_DIR=/);

    await setBrowserUseEnvironmentMode('direct', { homeDirectory });
    content = await readFile(path, 'utf8');
    assert.match(content, /CUSTOM_BROWSER_FLAG="keep-me"/);
    assert.doesNotMatch(content, /BU_CDP_URL=/);
    assert.doesNotMatch(content, /BH_TELEMETRY=/);
    assert.doesNotMatch(content, /BU_NAME=/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('removes an environment file when direct mode has no unrelated settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-empty-'));
  const homeDirectory = join(root, 'home');
  const path = browserUseEnvironmentPath(homeDirectory);
  try {
    await setBrowserUseEnvironmentMode('extension', { homeDirectory });
    await setBrowserUseEnvironmentMode('direct', { homeDirectory });
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
