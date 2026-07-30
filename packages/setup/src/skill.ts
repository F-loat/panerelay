import { cp, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PANERELAY_SKILL_NAME = 'panerelay-browser';

export interface SkillPathOptions {
  homeDirectory?: string;
  projectDirectory?: string;
  sourceDirectory?: string;
}

export function globalSkillPath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.agents', 'skills', PANERELAY_SKILL_NAME);
}

export function projectSkillPath(projectDirectory = process.cwd()): string {
  return join(projectDirectory, '.agents', 'skills', PANERELAY_SKILL_NAME);
}

function bundledSkillPath(): string {
  return fileURLToPath(new URL(`../skills/${PANERELAY_SKILL_NAME}`, import.meta.url));
}

export async function installPanerelaySkill(
  scope: 'global' | 'project',
  options: SkillPathOptions = {},
): Promise<string> {
  const target =
    scope === 'global'
      ? globalSkillPath(options.homeDirectory)
      : projectSkillPath(options.projectDirectory);
  await rm(target, { recursive: true, force: true });
  await cp(options.sourceDirectory ?? bundledSkillPath(), target, { recursive: true });
  return target;
}

export async function uninstallPanerelaySkill(
  scope: 'global' | 'project',
  options: SkillPathOptions = {},
): Promise<string> {
  const target =
    scope === 'global'
      ? globalSkillPath(options.homeDirectory)
      : projectSkillPath(options.projectDirectory);
  await rm(target, { recursive: true, force: true });
  return target;
}
