import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const outdir = await mkdtemp(join(tmpdir(), 'panerelay-extension-test-'));
const entryPoints = [
  'src/background/chromium/action-badge.test.ts',
  'src/background/chromium/browser-runtime.test.ts',
  'src/background/chromium/cdp-document-activity.test.ts',
  'src/background/shared/control-activity-state.test.ts',
  'src/background/chromium/controlled-favicon.test.ts',
  'src/background/shared/conversation-workspaces.test.ts',
  'src/background/shared/conversation-workspace-observers.test.ts',
  'src/background/shared/conversation-workspace-service.test.ts',
  'src/background/chromium/debugger-detach.test.ts',
  'src/background/firefox/webdriver-rendezvous.test.ts',
  'src/background/shared/native-host-readiness.test.ts',
  'src/background/shared/page-comments.test.ts',
  'src/background/routing-boundaries.test.ts',
  'src/background/chromium/target-publication.test.ts',
  'src/pages/sidepanel/provider-selection.test.ts',
  'src/pages/sidepanel/setup-guidance.test.ts',
  'src/shared/authorization.test.ts',
  'src/shared/identity.test.ts',
];

try {
  await build({
    bundle: true,
    entryPoints,
    format: 'esm',
    outdir,
    platform: 'node',
    sourcemap: 'inline',
    target: 'node20',
  });
  const testFiles = entryPoints.map(entry =>
    join(outdir, entry.replace(/^src\//, '').replace(/\.ts$/, '.js')),
  );
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Extension tests exited with code ${code ?? 'unknown'}`));
    });
  });
} finally {
  await rm(outdir, { force: true, recursive: true });
}
