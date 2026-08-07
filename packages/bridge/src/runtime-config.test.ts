import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeOpenCodePathSource, readRuntimeConfig } from './runtime-config.js';

test('normalizes missing and unknown OpenCode path origins as discovered', () => {
  assert.equal(normalizeOpenCodePathSource(undefined), 'discovered');
  assert.equal(normalizeOpenCodePathSource('unknown'), 'discovered');
  assert.equal(normalizeOpenCodePathSource('discovered'), 'discovered');
  assert.equal(normalizeOpenCodePathSource('override'), 'override');
});

test('reads legacy OpenCode paths as discovered and current environment overrides explicitly', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'panerelay-runtime-config-'));
  const runtimePath = path.join(root, 'runtime.json');
  const legacyPath = path.join(root, 'legacy-opencode');
  const overridePath = path.join(root, 'override-opencode');
  await Promise.all([legacyPath, overridePath].map(filePath => writeFile(filePath, 'fixture')));
  if (process.platform !== 'win32') {
    await Promise.all([legacyPath, overridePath].map(filePath => chmod(filePath, 0o755)));
  }

  try {
    await writeFile(
      runtimePath,
      `${JSON.stringify({ opencodePath: legacyPath, opencodeVersion: '1.2.27' })}\n`,
    );
    const legacy = await readRuntimeConfig({ environment: {}, path: runtimePath });
    assert.equal(legacy.opencodePath, legacyPath);
    assert.equal(legacy.opencodePathSource, 'discovered');
    assert.equal(legacy.opencodeVersion, '1.2.27');

    await writeFile(
      runtimePath,
      `${JSON.stringify({
        opencodePath: legacyPath,
        opencodePathSource: 'override',
        opencodeVersion: '1.2.27',
      })}\n`,
    );
    const persistedOverride = await readRuntimeConfig({ environment: {}, path: runtimePath });
    assert.equal(persistedOverride.opencodePathSource, 'override');

    const currentOverride = await readRuntimeConfig({
      environment: { PANERELAY_OPENCODE_PATH: overridePath },
      path: runtimePath,
    });
    assert.equal(currentOverride.opencodePath, overridePath);
    assert.equal(currentOverride.opencodePathSource, 'override');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
