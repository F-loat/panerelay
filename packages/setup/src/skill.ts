import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PANERELAY_SKILL_NAME = 'panerelay-browser';
export const PANERELAY_BROWSER_USE_SKILL_NAME = 'panerelay-browser-use';
const PANERELAY_BROWSER_USE_CLI_PLACEHOLDER = '{{PANERELAY_BROWSER_USE_CLI}}';
const PANERELAY_BROWSER_USE_MCP_PLACEHOLDER = '{{PANERELAY_BROWSER_USE_MCP}}';
const BROWSER_USE_EXECUTABLE_PLACEHOLDER = '{{BROWSER_USE_EXECUTABLE}}';

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

export function globalBrowserUseSkillPath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.agents', 'skills', PANERELAY_BROWSER_USE_SKILL_NAME);
}

function bundledSkillPath(): string {
  return fileURLToPath(new URL(`../skills/${PANERELAY_SKILL_NAME}`, import.meta.url));
}

function bundledBrowserUseSkillPath(): string {
  return fileURLToPath(new URL(`../skills/${PANERELAY_BROWSER_USE_SKILL_NAME}`, import.meta.url));
}

function skillCommandPath(cliLauncherPath: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') return `"${cliLauncherPath.replaceAll('"', '\\"')}"`;
  return `'${cliLauncherPath.replaceAll("'", `'"'"'`)}'`;
}

export async function installBrowserUseSkill(
  cliLauncherPath: string,
  options: SkillPathOptions & {
    browserUseExecutable: string;
    mcpLauncherPath?: string;
    platform?: NodeJS.Platform;
  },
): Promise<string> {
  const target = globalBrowserUseSkillPath(options.homeDirectory);
  await rm(target, { recursive: true, force: true });
  await cp(options.sourceDirectory ?? bundledBrowserUseSkillPath(), target, { recursive: true });
  const skillPath = join(target, 'SKILL.md');
  const template = await readFile(skillPath, 'utf8');
  if (
    !template.includes(PANERELAY_BROWSER_USE_CLI_PLACEHOLDER) ||
    !template.includes(PANERELAY_BROWSER_USE_MCP_PLACEHOLDER) ||
    !template.includes(BROWSER_USE_EXECUTABLE_PLACEHOLDER)
  ) {
    throw new Error('Panerelay Browser Use Skill template is invalid');
  }
  await writeFile(
    skillPath,
    template
      .replaceAll(
        PANERELAY_BROWSER_USE_CLI_PLACEHOLDER,
        skillCommandPath(cliLauncherPath, options.platform ?? process.platform),
      )
      .replaceAll(
        PANERELAY_BROWSER_USE_MCP_PLACEHOLDER,
        options.mcpLauncherPath
          ? skillCommandPath(options.mcpLauncherPath, options.platform ?? process.platform)
          : 'Unavailable until setup detects the pinned Browser Use and Browser Harness versions',
      )
      .replaceAll(
        BROWSER_USE_EXECUTABLE_PLACEHOLDER,
        skillCommandPath(options.browserUseExecutable, options.platform ?? process.platform),
      ),
  );
  return target;
}

export async function uninstallBrowserUseSkill(homeDirectory?: string): Promise<string> {
  const target = globalBrowserUseSkillPath(homeDirectory);
  await rm(target, { recursive: true, force: true });
  return target;
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
