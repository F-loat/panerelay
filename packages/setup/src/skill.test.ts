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

test('installs the additive Browser Use Skill with the exact private CLI path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-skill-'));
  const homeDirectory = join(root, 'home with space');
  const officialSkillPath = join(homeDirectory, '.agents', 'skills', 'browser-use', 'SKILL.md');
  const cliLauncherPath = join(homeDirectory, '.panerelay', 'bin', 'panerelay-browser-use-cli');
  const mcpLauncherPath = join(homeDirectory, '.panerelay', 'bin', 'panerelay-browser-use-mcp');
  const browserUseExecutable = join(homeDirectory, 'browser-use env', 'bin', 'browser-use');
  try {
    await mkdir(join(officialSkillPath, '..'), { recursive: true });
    await writeFile(officialSkillPath, 'official-browser-use-skill\n');
    const target = await installBrowserUseSkill(cliLauncherPath, {
      browserUseExecutable,
      homeDirectory,
      mcpLauncherPath,
      platform: 'linux',
    });
    const content = await readFile(join(target, 'SKILL.md'), 'utf8');
    assert.equal(target, globalBrowserUseSkillPath(homeDirectory));
    assert.equal(target.endsWith(PANERELAY_BROWSER_USE_SKILL_NAME), true);
    assert.match(content, /name: panerelay-browser-use/);
    assert.equal(content.includes(`run browser-use -- '${browserUseExecutable}'`), true);
    assert.match(content, /--mode extension/);
    assert.match(content, /Normal task completion does not close/);
    assert.match(content, /They are not task-isolated/);
    assert.equal(content.includes(`'${cliLauncherPath}'`), true);
    assert.equal(content.includes(`'${mcpLauncherPath}'`), true);
    assert.match(content, /--cli-mcp/);
    assert.match(content, /legacy `browser-use --mcp`/);
    assert.doesNotMatch(content, /Browser Harness|browser-harness/);
    assert.doesNotMatch(content, /\{\{PANERELAY_BROWSER_USE_CLI\}\}/);
    assert.doesNotMatch(content, /\{\{PANERELAY_BROWSER_USE_MCP\}\}/);
    assert.doesNotMatch(content, /\{\{BROWSER_USE_EXECUTABLE\}\}/);
    assert.equal(await readFile(officialSkillPath, 'utf8'), 'official-browser-use-skill\n');

    await uninstallBrowserUseSkill(homeDirectory);
    await assert.rejects(readFile(join(target, 'SKILL.md')), { code: 'ENOENT' });
    assert.equal(await readFile(officialSkillPath, 'utf8'), 'official-browser-use-skill\n');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
