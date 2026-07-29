import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configureGlobalProvider } from './config.js';
import { doctorPaneRelay } from './doctor.js';

test('doctor verifies the optional global default Provider', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-doctor-'));
  try {
    await configureGlobalProvider({ homeDirectory });
    const report = await doctorPaneRelay({
      globalProvider: true,
      homeDirectory,
      platform: 'linux',
    });
    const check = report.checks.find(item => item.id === 'global-provider');
    assert.equal(check?.status, 'pass');
    assert.equal(check?.detail, 'panerelay');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});
