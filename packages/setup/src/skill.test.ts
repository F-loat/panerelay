import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  globalBrowserUseSkillPath,
  installBrowserUseSkill,
  installPanerelaySkill,
  PANERELAY_BROWSER_USE_SKILL_NAME,
  PANERELAY_SKILL_NAME,
  uninstallBrowserUseSkill,
  uninstallPanerelaySkill,
} from './skill.js';

test('installs and removes the bundled Skill in global and project scopes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-skill-'));
  const homeDirectory = join(root, 'home');
  const projectDirectory = join(root, 'project');

  try {
    const globalPath = await installPanerelaySkill('global', { homeDirectory });
    const projectPath = await installPanerelaySkill('project', { projectDirectory });
    const globalSkill = await readFile(join(globalPath, 'SKILL.md'), 'utf8');
    const projectSkill = await readFile(join(projectPath, 'SKILL.md'), 'utf8');
    assert.match(globalSkill, /name: panerelay-browser/);
    assert.match(projectSkill, /--provider panerelay/);
    assert.match(projectSkill, /`screenshot` \(viewport or `--full`\)/);
    assert.match(projectSkill, /Do not use `inspect`/);
    assert.match(projectSkill, /Do not use `--allowed-domains`/);
    assert.match(projectSkill, /Treat `tab <id>` as an Agent-local selection/);
    assert.match(projectSkill, /share one authorized browser lease/);
    assert.doesNotMatch(projectSkill, /active relay session/);
    assert.equal(globalPath.endsWith(PANERELAY_SKILL_NAME), true);

    await uninstallPanerelaySkill('global', { homeDirectory });
    await uninstallPanerelaySkill('project', { projectDirectory });
    await assert.rejects(readFile(join(globalPath, 'SKILL.md')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(projectPath, 'SKILL.md')), { code: 'ENOENT' });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('installs the additive Browser Use Skill with official commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-skill-'));
  const homeDirectory = join(root, 'home with space');
  const officialSkillPath = join(homeDirectory, '.agents', 'skills', 'browser-use', 'SKILL.md');
  try {
    await mkdir(join(officialSkillPath, '..'), { recursive: true });
    await writeFile(officialSkillPath, 'official-browser-use-skill\n');
    await assert.rejects(
      installBrowserUseSkill({
        homeDirectory,
        setupVersion: '0.2.0-01',
      }),
      /setup version is invalid/i,
    );
    const target = await installBrowserUseSkill({
      homeDirectory,
      setupVersion: '0.2.0+build.1',
    });
    const content = await readFile(join(target, 'SKILL.md'), 'utf8');
    assert.equal(target, globalBrowserUseSkillPath(homeDirectory));
    assert.equal(target.endsWith(PANERELAY_BROWSER_USE_SKILL_NAME), true);
    assert.match(content, /name: panerelay-browser-use/);
    assert.match(content, /connection use browser-use extension/);
    assert.match(content, /Normal task completion does not close/);
    assert.match(content, /They are not task-isolated/);
    assert.match(content, /BU_CDP_URL=.*browser-use <<'PY'/);
    assert.match(content, /browser-use --cli-mcp/);
    assert.match(content, /--cli-mcp/);
    assert.match(content, /legacy `browser-use --mcp`/);
    assert.match(content, /npx --yes @panerelay\/setup@0\.2\.0\+build\.1 doctor --browser-use/);
    assert.match(content, /dispatch status is unknown after transport loss/);
    assert.match(content, /do not replay side-effecting work/);
    assert.match(content, /Retry only read-only, idempotent, or explicitly resumable invocations/);
    assert.match(content, /report the outcome as unknown/);
    assert.doesNotMatch(content, /For transport loss, retry once through the same run surface/);
    assert.match(content, /Browser Harness/);
    assert.doesNotMatch(content, /\{\{PANERELAY_BROWSER_USE_CLI\}\}/);
    assert.doesNotMatch(content, /\{\{PANERELAY_BROWSER_USE_MCP\}\}/);
    assert.doesNotMatch(content, /\{\{PANERELAY_SETUP_VERSION\}\}/);
    assert.doesNotMatch(content, /\{\{BROWSER_USE_EXECUTABLE\}\}/);
    assert.equal(await readFile(officialSkillPath, 'utf8'), 'official-browser-use-skill\n');

    await uninstallBrowserUseSkill(homeDirectory);
    await assert.rejects(readFile(join(target, 'SKILL.md')), { code: 'ENOENT' });
    assert.equal(await readFile(officialSkillPath, 'utf8'), 'official-browser-use-skill\n');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
