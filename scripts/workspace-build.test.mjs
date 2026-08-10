import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const workspacePackagePaths = [
  '../apps/extension/package.json',
  '../apps/website/package.json',
  '../packages/adapters/agent-browser/package.json',
  '../packages/adapters/browser-use/package.json',
  '../packages/adapters/playwright/package.json',
  '../packages/bridge/package.json',
  '../packages/browser-registry/package.json',
  '../packages/cli/package.json',
  '../packages/protocol/package.json',
  '../packages/setup/package.json',
  '../packages/site-kit/package.json',
  '../packages/sites/package.json',
];
const workspacePackages = await Promise.all(
  workspacePackagePaths.map(async path =>
    JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')),
  ),
);

test('root validation builds once and runs every compiled test suite without nested builds', () => {
  assert.equal(
    root.scripts.check,
    'pnpm run format:check && pnpm run lint:strict && pnpm run build && pnpm run typecheck && pnpm run test:compiled',
  );
  assert.equal(root.scripts.typecheck, 'pnpm -r --if-present typecheck');
  assert.equal(
    root.scripts['test:compiled'],
    'pnpm -r --if-present test:compiled && node --test scripts/*.test.mjs',
  );
  assert.equal(root.scripts.test, 'pnpm run build && pnpm run test:compiled');

  for (const manifest of workspacePackages) {
    assert.ok(manifest.scripts?.build, `${manifest.name} is missing build`);
    assert.ok(manifest.scripts?.test, `${manifest.name} is missing test`);
    assert.ok(manifest.scripts?.['test:compiled'], `${manifest.name} is missing test:compiled`);
    assert.doesNotMatch(
      manifest.scripts['test:compiled'],
      /(?:^|\s)(?:pnpm|npm)\s+(?:run\s+)?build(?:\s|$)/,
      `${manifest.name} compiled tests rebuild outputs`,
    );
    assert.doesNotMatch(
      manifest.scripts.build,
      /@panerelay\/sites|packages\/sites/,
      `${manifest.name} directly rebuilds the sites catalog`,
    );
  }

  const sites = workspacePackages.find(manifest => manifest.name === '@panerelay/sites');
  assert.equal(sites.scripts.build, 'node clean.mjs && tsc -p tsconfig.json && node build.mjs');
});
