import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installPanerelaySkill, PANERELAY_SKILL_NAME, uninstallPanerelaySkill } from './skill.js';

test('installs and removes the bundled Skill in global and project scopes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-skill-'));
  const homeDirectory = join(root, 'home');
  const projectDirectory = join(root, 'project');

  try {
    const globalPath = await installPanerelaySkill('global', { homeDirectory });
    const projectPath = await installPanerelaySkill('project', { projectDirectory });
    assert.match(await readFile(join(globalPath, 'SKILL.md'), 'utf8'), /name: panerelay-browser/);
    assert.match(await readFile(join(projectPath, 'SKILL.md'), 'utf8'), /--provider panerelay/);
    assert.equal(globalPath.endsWith(PANERELAY_SKILL_NAME), true);

    await uninstallPanerelaySkill('global', { homeDirectory });
    await uninstallPanerelaySkill('project', { projectDirectory });
    await assert.rejects(readFile(join(globalPath, 'SKILL.md')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(projectPath, 'SKILL.md')), { code: 'ENOENT' });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
