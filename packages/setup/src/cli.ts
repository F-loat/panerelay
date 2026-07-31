#!/usr/bin/env node

import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { doctorPanerelay, type DoctorReport } from './doctor.js';
import { normalizeLocale, resolveLocale, translate, type SupportedLocale } from './i18n.js';
import { setupPanerelay, uninstallPanerelay } from './lifecycle.js';

const PANERELAY_CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

export type SetupOperation = 'setup' | 'doctor' | 'uninstall';

export interface ParsedSetupArgs {
  extensionId?: string;
  globalProvider: boolean;
  help: boolean;
  json: boolean;
  language?: SupportedLocale;
  operation: SetupOperation;
  project: boolean;
  yes: boolean;
}

interface LanguageArguments {
  argv: string[];
  language?: SupportedLocale;
}

function languageValue(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument === '--lang') return argv[index + 1];
    if (argument.startsWith('--lang=')) return argument.slice('--lang='.length);
  }
  return undefined;
}

function extractLanguageArguments(argv: string[]): LanguageArguments {
  const remaining: string[] = [];
  let rawLanguage: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (argument !== '--lang' && !argument.startsWith('--lang=')) {
      remaining.push(argument);
      continue;
    }
    if (rawLanguage !== undefined) throw new Error('LANGUAGE_REPEATED');
    rawLanguage = argument === '--lang' ? argv[index + 1] : argument.slice('--lang='.length);
    if (!rawLanguage || rawLanguage.startsWith('-')) throw new Error('LANGUAGE_MISSING');
    if (argument === '--lang') index += 1;
  }
  if (!rawLanguage) return { argv: remaining };
  const language = normalizeLocale(rawLanguage);
  if (!language) throw new Error(`LANGUAGE_UNSUPPORTED:${rawLanguage}`);
  return { argv: remaining, language };
}

export function parseSetupArgs(argv: string[]): ParsedSetupArgs {
  const localized = extractLanguageArguments(argv);
  if (localized.argv.includes('--help') || localized.argv.includes('-h')) {
    return {
      globalProvider: false,
      help: true,
      json: false,
      language: localized.language,
      operation: 'setup',
      project: false,
      yes: false,
    };
  }
  const command =
    localized.argv[0] && !localized.argv[0].startsWith('-') ? localized.argv[0] : 'setup';
  const operation =
    command === 'setup' || command === 'install' || command === 'update'
      ? 'setup'
      : command === 'doctor'
        ? 'doctor'
        : command === 'uninstall'
          ? 'uninstall'
          : undefined;
  if (!operation) throw new Error(`Unknown command: ${command}`);

  let project = false;
  let globalProvider = false;
  let json = false;
  let yes = false;
  let extensionId: string | undefined;
  const optionStart = command === localized.argv[0] ? 1 : 0;
  for (let index = optionStart; index < localized.argv.length; index += 1) {
    const argument = localized.argv[index]!;
    if (argument === '--project-provider') project = true;
    else if (argument === '--global-provider') globalProvider = true;
    else if (argument === '--json') json = true;
    else if (argument === '--extension-id' || argument.startsWith('--extension-id=')) {
      if (extensionId !== undefined) throw new Error('EXTENSION_ID_REPEATED');
      const value =
        argument === '--extension-id'
          ? localized.argv[++index]
          : argument.slice('--extension-id='.length);
      if (!value || value.startsWith('-')) throw new Error('EXTENSION_ID_MISSING');
      extensionId = value;
    } else if (argument === '--yes' || argument === '-y' || argument === '--non-interactive') {
      yes = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (json && operation !== 'doctor') {
    throw new Error('--json is only available with doctor');
  }
  if (globalProvider && operation === 'uninstall') {
    throw new Error('--global-provider is not needed with uninstall');
  }
  if (extensionId && operation === 'uninstall') {
    throw new Error('--extension-id is not available with uninstall');
  }
  return {
    ...(extensionId ? { extensionId } : {}),
    globalProvider,
    help: false,
    json,
    language: localized.language,
    operation,
    project,
    yes,
  };
}

function printHelp(locale: SupportedLocale): void {
  console.log(translate(locale, 'help'));
}

const doctorLabels: Record<string, { en: string; 'zh-CN': string }> = {
  'agent-browser': { en: 'agent-browser', 'zh-CN': 'agent-browser' },
  claude: { en: 'Claude Code (optional)', 'zh-CN': 'Claude Code（可选）' },
  codex: { en: 'Codex', 'zh-CN': 'Codex' },
  extension: { en: 'Extension', 'zh-CN': '扩展' },
  'extension-id': { en: 'Effective Extension ID', 'zh-CN': '生效的扩展 ID' },
  'global-provider': { en: 'User default', 'zh-CN': '用户级默认值' },
  'native-host': { en: 'Native Host', 'zh-CN': 'Native Host' },
  'native-launcher': {
    en: 'Native Host launcher',
    'zh-CN': 'Native Host 启动器',
  },
  'native-manifest': {
    en: 'Native Messaging manifest',
    'zh-CN': 'Native Messaging 清单',
  },
  node: { en: 'Node.js', 'zh-CN': 'Node.js' },
  'project-provider': { en: 'Project default', 'zh-CN': '项目级默认值' },
  'project-skill': { en: 'Project Agent Skill', 'zh-CN': '项目 Agent Skill' },
  provider: {
    en: 'agent-browser Provider',
    'zh-CN': 'agent-browser Provider',
  },
  qoder: { en: 'Qoder (optional)', 'zh-CN': 'Qoder（可选）' },
  skill: { en: 'Agent Skill', 'zh-CN': 'Agent Skill' },
  'windows-registry': {
    en: 'Native Messaging registry',
    'zh-CN': 'Native Messaging 注册表',
  },
};

const doctorGroups = [
  {
    ids: ['node', 'agent-browser', 'codex', 'claude', 'qoder'],
    title: 'doctorGroupEnvironment',
  },
  {
    ids: [
      'native-host',
      'native-launcher',
      'native-manifest',
      'windows-registry',
      'extension-id',
      'provider',
      'skill',
    ],
    title: 'doctorGroupIntegration',
  },
  {
    ids: ['extension'],
    title: 'doctorGroupBrowser',
  },
  {
    ids: ['global-provider', 'project-provider', 'project-skill'],
    title: 'doctorGroupDefaultProvider',
  },
] as const;

function doctorDetail(detail: string, locale: SupportedLocale): string {
  if (locale === 'en') return detail;
  if (detail === 'Not found') return '未找到';
  if (detail === 'Not configured') return '未配置';
  if (detail === 'No valid Panerelay manifest was found') return '未找到有效的 Panerelay 清单';
  if (detail === 'Extension is not currently connected') return '扩展当前未连接';
  if (detail === 'Connected Extension ID does not match the effective Extension ID') {
    return '已连接扩展的 ID 与生效扩展 ID 不一致';
  }
  if (detail === 'Extension ID must contain exactly 32 lowercase letters from a through p.') {
    return '扩展 ID 必须恰好包含 32 个 a 到 p 的小写字母';
  }
  const processMatch = /^Connected through process (\d+)$/.exec(detail);
  if (processMatch) return `已通过进程 ${processMatch[1]} 连接`;
  return detail;
}

function doctorHint(id: string, hint: string, locale: SupportedLocale): string {
  if (locale === 'en') return hint;
  if (id === 'node') return '请安装 Node.js 20 或更高版本';
  if (id === 'codex') return '请安装 Codex CLI，然后运行：npx --yes @panerelay/setup';
  if (id === 'claude') {
    return '请安装 Claude Code 或设置 PANERELAY_CLAUDE_PATH，然后运行：npx --yes @panerelay/setup';
  }
  if (id === 'agent-browser') {
    return hint.startsWith('Upgrade ')
      ? '请将 agent-browser 升级到 0.33.0 或更高版本'
      : '请安装可正常运行的 agent-browser 0.33.0 或更高版本，然后运行：npx --yes @panerelay/setup';
  }
  if (id === 'qoder') {
    return '请安装 Qoder CLI 或设置 PANERELAY_QODER_PATH，然后运行：npx --yes @panerelay/setup';
  }
  if (id === 'extension') return '请加载或重新加载扩展，然后打开侧边栏';
  if (id === 'extension-id') return '请使用仅包含 a 到 p 的 32 位 Chrome 扩展 ID';
  if (id === 'global-provider') return '请运行：npx --yes @panerelay/setup --global-provider';
  if (id === 'project-provider' || id === 'project-skill') {
    return '请运行：npx --yes @panerelay/setup --project-provider';
  }
  return '请运行：npx --yes @panerelay/setup';
}

function printDoctor(report: DoctorReport, locale: SupportedLocale): void {
  const renderedIds = new Set<string>();
  const renderGroup = (
    title: Parameters<typeof translate>[1],
    checks: DoctorReport['checks'],
  ): void => {
    if (checks.length === 0) return;
    console.log('');
    console.log(translate(locale, title));
    for (const check of checks) {
      renderedIds.add(check.id);
      const marker = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
      const label = doctorLabels[check.id]?.[locale] ?? check.label;
      console.log(`  ${marker} ${label} — ${doctorDetail(check.detail, locale)}`);
      if (check.hint) {
        const hintLabel = translate(locale, check.status === 'fail' ? 'doctorFix' : 'doctorTip');
        console.log(`     ${hintLabel}: ${doctorHint(check.id, check.hint, locale)}`);
      }
    }
  };

  console.log(translate(locale, 'doctorTitle'));
  for (const group of doctorGroups) {
    renderGroup(
      group.title,
      group.ids.flatMap(id => report.checks.filter(check => check.id === id)),
    );
  }
  renderGroup(
    'doctorGroupOther',
    report.checks.filter(check => !renderedIds.has(check.id)),
  );

  const failed = report.checks.filter(check => check.status === 'fail').length;
  const warnings = report.checks.filter(check => check.status === 'warn').length;
  console.log('');
  if (failed > 0) {
    console.log(`❌ ${translate(locale, 'doctorAttention')}`);
    const counts = [translate(locale, 'doctorFailureCount', { count: String(failed) })];
    if (warnings > 0) {
      counts.push(translate(locale, 'doctorWarningCount', { count: String(warnings) }));
    }
    console.log(`   ${counts.join(' · ')}`);
    console.log(`   ${translate(locale, 'doctorRerun')}`);
  } else {
    console.log(`${warnings > 0 ? '✅' : '🎉'} ${translate(locale, 'doctorReady')}`);
    if (warnings > 0) {
      console.log(`   ${translate(locale, 'doctorWarningCount', { count: String(warnings) })}`);
    }
  }
}

async function confirmUninstall(locale: SupportedLocale): Promise<boolean> {
  if (!stdin.isTTY || !stdout.isTTY) return false;
  const input = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await input.question(translate(locale, 'uninstallPrompt')))
      .trim()
      .toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    input.close();
  }
}

export interface CliDependencies {
  confirm?: () => Promise<boolean>;
  doctor?: typeof doctorPanerelay;
  environment?: NodeJS.ProcessEnv;
  setup?: typeof setupPanerelay;
  systemLocale?: string;
  uninstall?: typeof uninstallPanerelay;
}

function localizeArgumentError(error: unknown, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'LANGUAGE_MISSING') return translate(locale, 'errorLanguageMissing');
  if (message === 'LANGUAGE_REPEATED') return translate(locale, 'errorLanguageRepeated');
  if (message === 'EXTENSION_ID_MISSING') return translate(locale, 'errorExtensionIdMissing');
  if (message === 'EXTENSION_ID_REPEATED') return translate(locale, 'errorExtensionIdRepeated');
  if (message.startsWith('LANGUAGE_UNSUPPORTED:')) {
    return translate(locale, 'errorLanguageUnsupported', {
      language: message.slice('LANGUAGE_UNSUPPORTED:'.length),
    });
  }
  if (message.startsWith('Unknown command: ')) {
    return translate(locale, 'errorUnknownCommand', {
      command: message.slice('Unknown command: '.length),
    });
  }
  if (message.startsWith('Unknown option: ')) {
    return translate(locale, 'errorUnknownOption', {
      option: message.slice('Unknown option: '.length),
    });
  }
  if (message === '--json is only available with doctor') {
    return translate(locale, 'errorJsonDoctorOnly');
  }
  if (message === '--global-provider is not needed with uninstall') {
    return translate(locale, 'errorGlobalProviderUninstall');
  }
  if (message === '--extension-id is not available with uninstall') {
    return translate(locale, 'errorExtensionIdUninstall');
  }
  return message;
}

export async function main(
  argv: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  let locale = resolveLocale({
    environment: dependencies.environment,
    requestedLocale: languageValue(argv),
    systemLocale: dependencies.systemLocale,
  });
  let parsed: ParsedSetupArgs;
  try {
    parsed = parseSetupArgs(argv);
  } catch (error) {
    console.error(localizeArgumentError(error, locale));
    printHelp(locale);
    return 2;
  }
  locale = parsed.language ?? locale;
  if (parsed.help) {
    printHelp(locale);
    return 0;
  }

  try {
    if (parsed.operation === 'doctor') {
      const report = await (dependencies.doctor ?? doctorPanerelay)({
        environment: dependencies.environment,
        extensionId: parsed.extensionId,
        globalProvider: parsed.globalProvider,
        project: parsed.project,
      });
      if (parsed.json) console.log(JSON.stringify(report, null, 2));
      else printDoctor(report, locale);
      return report.ok ? 0 : 1;
    }
    if (parsed.operation === 'uninstall') {
      const confirmed =
        parsed.yes || (await (dependencies.confirm ?? (() => confirmUninstall(locale)))());
      if (!confirmed) {
        console.error(
          stdin.isTTY && stdout.isTTY
            ? translate(locale, 'uninstallCancelled')
            : translate(locale, 'nonInteractiveUninstall'),
        );
        return 2;
      }
      await (dependencies.uninstall ?? uninstallPanerelay)({ project: parsed.project });
      console.log(translate(locale, 'uninstallComplete'));
      return 0;
    }

    const result = await (dependencies.setup ?? setupPanerelay)({
      environment: dependencies.environment,
      extensionId: parsed.extensionId,
      globalProvider: parsed.globalProvider,
      project: parsed.project,
    });
    console.log(translate(locale, 'setupComplete'));
    console.log(translate(locale, 'nativeHost', { path: result.host.hostPath }));
    console.log(translate(locale, 'extensionIdentity', { id: result.host.extensionId }));
    console.log(
      result.host.extensionId === PANERELAY_EXTENSION_ID
        ? translate(locale, 'extensionStoreNextStep', {
            url: PANERELAY_CHROME_WEB_STORE_URL,
          })
        : translate(locale, 'extensionCustomNextStep', { id: result.host.extensionId }),
    );
    console.log(translate(locale, 'agentSkill', { path: result.globalSkillPath }));
    if (!result.host.codexPath) console.log(translate(locale, 'codexMissing'));
    if (!result.host.claudePath) console.log(translate(locale, 'claudeMissing'));
    if (!result.host.agentBrowserPath) console.log(translate(locale, 'agentBrowserMissing'));
    if (result.projectConfigPath) {
      console.log(translate(locale, 'projectProvider', { path: result.projectConfigPath }));
    }
    if (result.globalProvider) {
      console.log(translate(locale, 'globalProvider', { path: result.agentBrowserConfigPath }));
    }
    console.log(translate(locale, 'agentCommand'));
    return result.host.agentBrowserSupported ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1];
const isMainModule = (() => {
  if (!invokedFile) return false;
  try {
    return realpathSync(resolve(invokedFile)) === realpathSync(currentFile);
  } catch {
    return resolve(invokedFile) === currentFile;
  }
})();
if (isMainModule) {
  process.exitCode = await main();
}
