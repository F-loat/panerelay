import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('publishes one unified repository Skill for all supported engines', async () => {
  assert.deepEqual(await readdir(new URL('skills/', root)), ['panerelay-browser']);

  const skill = await read('skills/panerelay-browser/SKILL.md');
  assert.match(skill, /^---\nname: panerelay-browser\n/m);
  assert.match(skill, /## agent-browser workflow/);
  assert.match(skill, /## Browser Use workflow/);
  assert.match(skill, /## Playwright CLI workflow/);
  assert.match(skill, /<panerelay-context version="1">/);
  assert.match(skill, /first local tab must be `t1`/);
  assert.match(skill, /BU_NAME=panerelay/);
  assert.match(skill, /switch_tab\("<target-uuid>"\)/);
  assert.match(skill, /tab-select 0/);
  assert.match(skill, /Do not locate by URL or title/);
  assert.match(skill, /Do not start a per-conversation or fallback daemon/);
  assert.match(skill, /If no trusted setup hint exists, select `agent-browser`/);
  assert.match(skill, /Do not probe all three supported executables/);
  assert.match(skill, /ask the user to choose an engine merely because none was named/);
  assert.match(skill, /Select exactly one engine/);
  assert.match(skill, /Use the engine the user names/);
  assert.match(skill, /Do not inspect the other listed registrations/);
  assert.match(skill, /Do not switch engines merely because the cached hint was stale/);
  assert.match(skill, /npx skills add F-loat\/panerelay --skill panerelay-browser/);
  assert.match(skill, /npx skills update panerelay-browser/);
  assert.match(skill, /npx skills remove panerelay-browser/);
});

test('marks repository-only workflow Skills as internal', async () => {
  const developmentSkills = await readdir(new URL('.codex/skills/', root));
  assert.ok(developmentSkills.length > 0);
  for (const skillName of developmentSkills) {
    const skill = await read(`.codex/skills/${skillName}/SKILL.md`);
    assert.match(skill, /metadata:\n(?:  [^\n]+\n)*  internal: true\n/);
  }
});

test('keeps setup package and doctor independent from Skill lifecycle', async () => {
  const setupManifest = JSON.parse(await read('packages/setup/package.json'));
  const setupSources = await Promise.all([
    read('packages/setup/src/lifecycle.ts'),
    read('packages/setup/src/doctor.ts'),
    read('packages/setup/src/index.ts'),
  ]);

  assert.equal(setupManifest.files.includes('skills'), false);
  for (const source of setupSources) {
    assert.doesNotMatch(source, /installSkill|uninstallSkill|checkSkill|skillRoot/);
  }
});
