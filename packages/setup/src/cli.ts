#!/usr/bin/env node

import {
  confirm as confirmPrompt,
  isCancel,
  multiselect,
  spinner as createSpinner,
} from '@clack/prompts';
import { PANERELAY_EXTENSION_ID, type FetchAdapterRegistration } from '@panerelay/protocol';
import {
  PANERELAY_BROWSER_USE_GATEWAY_URL,
  browserUseEnvironmentPath,
} from '@panerelay/browser-use';
import { PANERELAY_PLAYWRIGHT_GATEWAY_URL } from '@panerelay/playwright';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { doctorPanerelay, type DoctorReport } from './doctor.js';
import { normalizeLocale, resolveLocale, translate, type SupportedLocale } from './i18n.js';
import {
  readInteractiveSetupState,
  type InteractiveSetupState,
  type SetupIntegration,
} from './interactive-setup-state.js';
import { setupPanerelay, uninstallPanerelay, type PanerelaySetupOptions } from './lifecycle.js';
import { installFetchAdapters, listFetchAdapters, removeFetchAdapters } from './fetch-adapters.js';

const PANERELAY_CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

export type SetupOperation = 'setup' | 'doctor' | 'uninstall' | 'add' | 'remove' | 'adapters';

export interface ParsedSetupArgs {
  agentBrowser: boolean;
  browserUse: boolean;
  playwright: boolean;
  extensionId?: string;
  globalDefault: boolean;
  help: boolean;
  json: boolean;
  language?: SupportedLocale;
  operation: SetupOperation;
  yes: boolean;
  adapterItems?: string[];
  adapterAll?: boolean;
}

interface LanguageArguments {
  argv: string[];
  language?: SupportedLocale;
}

function versionRequested(argv: string[]): boolean {
  return argv.includes('--version') || argv.includes('-v');
}

async function packageVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version?: unknown };
  if (typeof manifest.version !== 'string') throw new Error('Setup package version is invalid');
  return manifest.version;
}

interface SetupIntegrationPrompt {
  initialValues: readonly SetupIntegration[];
  message: string;
  options: ReadonlyArray<{
    hint: string;
    label: string;
    value: SetupIntegration;
  }>;
}

interface SetupConfirmationPrompt {
  active: string;
  inactive: string;
  initialValue: boolean;
  message: string;
}

type SetupSelectIntegrations = (
  prompt: SetupIntegrationPrompt,
) => Promise<readonly SetupIntegration[] | undefined>;
type SetupConfirm = (prompt: SetupConfirmationPrompt) => Promise<boolean | undefined>;

export interface SetupProgress {
  error(message?: string): void;
  start(message?: string): void;
  stop(message?: string): void;
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
      agentBrowser: false,
      browserUse: false,
      playwright: false,
      globalDefault: false,
      help: true,
      json: false,
      language: localized.language,
      operation: 'setup',
      yes: false,
    };
  }
  const command =
    localized.argv[0] && !localized.argv[0].startsWith('-') ? localized.argv[0] : 'setup';
  const operation: SetupOperation | undefined =
    command === 'setup' || command === 'install' || command === 'update'
      ? 'setup'
      : command === 'doctor'
        ? 'doctor'
        : command === 'uninstall'
          ? 'uninstall'
          : command === 'add' || command === 'remove' || command === 'adapters'
            ? command
            : undefined;
  if (!operation) throw new Error(`Unknown command: ${command}`);
  const optionStart = command === localized.argv[0] ? 1 : 0;

  if (operation === 'add' || operation === 'remove' || operation === 'adapters') {
    const adapterItems: string[] = [];
    let adapterAll = false;
    for (let index = optionStart; index < localized.argv.length; index += 1) {
      const argument = localized.argv[index]!;
      if (argument === '--all') {
        if (adapterAll) throw new Error('--all can only be provided once');
        adapterAll = true;
      } else if (argument.startsWith('-')) {
        throw new Error(`Unknown option: ${argument}`);
      } else {
        adapterItems.push(argument);
      }
    }
    if (operation === 'adapters' && (adapterItems.length > 0 || adapterAll)) {
      throw new Error('adapters does not accept arguments');
    }
    if (
      (operation === 'add' || operation === 'remove') &&
      adapterItems.length === 0 &&
      !adapterAll
    ) {
      throw new Error(`${operation} requires at least one adapter or --all`);
    }
    if (adapterAll && adapterItems.length > 0) {
      throw new Error('--all cannot be combined with adapter names or paths');
    }
    return {
      agentBrowser: false,
      browserUse: false,
      playwright: false,
      globalDefault: false,
      help: false,
      json: false,
      language: localized.language,
      operation,
      yes: false,
      ...(adapterItems.length > 0 ? { adapterItems } : {}),
      ...(adapterAll ? { adapterAll: true } : {}),
    };
  }

  let globalDefault = false;
  let agentBrowser = false;
  let browserUse = false;
  let playwright = false;
  let json = false;
  let yes = false;
  let extensionId: string | undefined;
  for (let index = optionStart; index < localized.argv.length; index += 1) {
    const argument = localized.argv[index]!;
    if (argument === '--global-default') globalDefault = true;
    else if (argument === '--agent-browser') agentBrowser = true;
    else if (argument === '--browser-use') browserUse = true;
    else if (argument === '--playwright') playwright = true;
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
  if (globalDefault && operation === 'uninstall') {
    throw new Error('--global-default is not needed with uninstall');
  }
  if (agentBrowser && operation === 'uninstall') {
    throw new Error('--agent-browser is not needed with uninstall');
  }
  if (browserUse && operation === 'uninstall') {
    throw new Error('--browser-use is not needed with uninstall');
  }
  if (playwright && operation === 'uninstall') {
    throw new Error('--playwright is not needed with uninstall');
  }
  if (extensionId && operation === 'uninstall') {
    throw new Error('--extension-id is not available with uninstall');
  }
  if (globalDefault && !agentBrowser && !browserUse) {
    throw new Error('--global-default requires --agent-browser or --browser-use');
  }
  return {
    agentBrowser,
    browserUse,
    playwright,
    ...(extensionId ? { extensionId } : {}),
    globalDefault,
    help: false,
    json,
    language: localized.language,
    operation,
    yes,
  };
}

function printHelp(locale: SupportedLocale): void {
  console.log(translate(locale, 'help'));
}

type SetupCheckStatus = 'pass' | 'warn' | 'fail';

function setupStatusMarker(status: SetupCheckStatus): string {
  return status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
}

function printSetupCheck(status: SetupCheckStatus, label: string, detail: string): void {
  console.log(`  ${setupStatusMarker(status)} ${label} — ${detail}`);
}

function printSetupSubline(label: string, detail: string): void {
  console.log(`     ${label} — ${detail}`);
}

function printSetupCommand(label: string, command: string): void {
  const [firstLine, ...remainingLines] = command.split('\n');
  if (remainingLines.length === 0) {
    console.log(`     ${label} ${firstLine ?? ''}`);
    return;
  }
  console.log(`     ${label}`);
  console.log(command);
}

function agentBrowserCommand(globalDefault: boolean): string {
  return globalDefault ? 'agent-browser tab list' : 'agent-browser --provider panerelay tab list';
}

function browserUseCommand(globalDefault: boolean): string {
  const environment = globalDefault ? '' : `BU_CDP_URL=${PANERELAY_BROWSER_USE_GATEWAY_URL} `;
  return `${environment}browser-use <<'PY'\nprint(list_tabs())\nPY`;
}

const doctorLabels: Record<string, { en: string; 'zh-CN': string }> = {
  'agent-browser': { en: 'agent-browser', 'zh-CN': 'agent-browser' },
  'browser-use': { en: 'Browser Use', 'zh-CN': 'Browser Use' },
  playwright: { en: 'Playwright CLI', 'zh-CN': 'Playwright CLI' },
  claude: { en: 'Claude Code (optional)', 'zh-CN': 'Claude Code（可选）' },
  codex: { en: 'Codex', 'zh-CN': 'Codex' },
  extension: { en: 'Extension', 'zh-CN': '扩展' },
  'extension-id': { en: 'Effective Extension ID', 'zh-CN': '生效的扩展 ID' },
  'global-default': { en: 'User default', 'zh-CN': '用户级默认值' },
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
  'browser-use-default': { en: 'Browser Use user default', 'zh-CN': 'Browser Use 用户级默认值' },
  provider: {
    en: 'agent-browser Provider',
    'zh-CN': 'agent-browser Provider',
  },
  qoder: { en: 'Qoder (optional)', 'zh-CN': 'Qoder（可选）' },
  opencode: { en: 'OpenCode (optional)', 'zh-CN': 'OpenCode（可选）' },
  'windows-registry-chrome': {
    en: 'Chrome Native Messaging registry',
    'zh-CN': 'Chrome Native Messaging 注册表',
  },
  'windows-registry-edge': {
    en: 'Edge Native Messaging registry',
    'zh-CN': 'Edge Native Messaging 注册表',
  },
};

const doctorGroups = [
  {
    ids: [
      'node',
      'browser-use',
      'playwright',
      'agent-browser',
      'codex',
      'claude',
      'qoder',
      'opencode',
    ],
    title: 'doctorGroupEnvironment',
  },
  {
    ids: [
      'native-host',
      'native-launcher',
      'native-manifest',
      'windows-registry-chrome',
      'windows-registry-edge',
      'extension-id',
      'provider',
    ],
    title: 'doctorGroupIntegration',
  },
  {
    ids: ['extension'],
    title: 'doctorGroupBrowser',
  },
  {
    ids: ['global-default', 'browser-use-default'],
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
      : '请安装可正常运行的 agent-browser 0.33.0 或更高版本，然后运行：npx --yes @panerelay/setup --agent-browser';
  }
  if (id === 'browser-use') {
    return hint.includes('doctor --browser-use')
      ? '请修复或升级到 Browser Use 0.13.7 或更高版本，然后重新运行：npx --yes @panerelay/setup doctor --browser-use'
      : '请安装 Browser Use 0.13.7 或更高版本，然后重新运行：npx --yes @panerelay/setup --browser-use';
  }
  if (id === 'playwright') {
    return hint.includes('doctor --playwright')
      ? '请修复或升级 Playwright CLI，然后重新运行：npx --yes @panerelay/setup doctor --playwright'
      : '请安装 Playwright CLI，然后重新运行：npx --yes @panerelay/setup --playwright';
  }
  if (id === 'qoder') {
    return '请安装 Qoder CLI 或设置 PANERELAY_QODER_PATH，然后运行：npx --yes @panerelay/setup';
  }
  if (id === 'opencode') {
    return '请安装 OpenCode 或设置 PANERELAY_OPENCODE_PATH，然后运行：npx --yes @panerelay/setup';
  }
  if (id === 'extension') return '请加载或重新加载扩展，然后打开侧边栏';
  if (id === 'extension-id') return '请使用仅包含 a 到 p 的 32 位 Chrome 扩展 ID';
  if (id === 'global-default') {
    return '请运行：npx --yes @panerelay/setup --agent-browser --global-default';
  }
  if (id === 'browser-use-default') {
    return '请运行：npx --yes @panerelay/setup --browser-use --global-default';
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

async function promptConfirmation(prompt: SetupConfirmationPrompt): Promise<boolean | undefined> {
  const answer = await confirmPrompt({
    ...prompt,
    input: stdin,
    output: stdout,
  });
  return isCancel(answer) ? undefined : answer;
}

function confirmationPrompt(
  locale: SupportedLocale,
  message: string,
  initialValue = false,
): SetupConfirmationPrompt {
  return {
    active: translate(locale, 'confirmYes'),
    inactive: translate(locale, 'confirmNo'),
    initialValue,
    message,
  };
}

async function confirmUninstall(locale: SupportedLocale): Promise<boolean | undefined> {
  if (!stdin.isTTY || !stdout.isTTY) return false;
  return promptConfirmation(confirmationPrompt(locale, translate(locale, 'uninstallPrompt')));
}

export interface CliDependencies {
  confirm?: () => Promise<boolean | undefined>;
  confirmDefault?: SetupConfirm;
  createSetupProgress?: () => SetupProgress;
  doctor?: typeof doctorPanerelay;
  environment?: NodeJS.ProcessEnv;
  interactive?: () => boolean;
  installFetchAdapters?: typeof installFetchAdapters;
  listFetchAdapters?: typeof listFetchAdapters;
  readInteractiveState?: typeof readInteractiveSetupState;
  selectIntegrations?: SetupSelectIntegrations;
  removeFetchAdapters?: typeof removeFetchAdapters;
  setup?: typeof setupPanerelay;
  systemLocale?: string;
  uninstall?: typeof uninstallPanerelay;
}

function isInteractiveTerminal(): boolean {
  return stdin.isTTY === true && stdout.isTTY === true;
}

function terminalSetupProgress(): SetupProgress | undefined {
  if (!isInteractiveTerminal()) return undefined;
  return createSpinner({ indicator: 'timer', output: stdout });
}

async function promptIntegrations(
  prompt: SetupIntegrationPrompt,
): Promise<readonly SetupIntegration[] | undefined> {
  const selected = await multiselect<SetupIntegration>({
    initialValues: [...prompt.initialValues],
    input: stdin,
    message: prompt.message,
    options: [...prompt.options],
    output: stdout,
    required: false,
  });
  return isCancel(selected) ? undefined : selected;
}

async function selectOptionalIntegrations(
  locale: SupportedLocale,
  currentState: InteractiveSetupState,
  selectIntegrations: SetupSelectIntegrations,
  confirmDefault: SetupConfirm,
): Promise<
  | (Pick<ParsedSetupArgs, 'agentBrowser' | 'browserUse' | 'playwright' | 'globalDefault'> & {
      browserUseDefault: 'direct' | 'extension';
      reconcileIntegrations: true;
    })
  | undefined
> {
  const selection = await selectIntegrations({
    initialValues: currentState.integrations,
    message: translate(locale, 'integrationSelectPrompt'),
    options: [
      {
        hint: translate(locale, 'integrationAgentBrowserHint'),
        label: 'agent-browser',
        value: 'agentBrowser',
      },
      {
        hint: translate(locale, 'integrationBrowserUseHint'),
        label: 'Browser Use',
        value: 'browserUse',
      },
      {
        hint: translate(locale, 'integrationPlaywrightHint'),
        label: 'Playwright CLI',
        value: 'playwright',
      },
    ],
  });
  if (!selection) return undefined;

  const selected = new Set(selection);
  let globalDefault = false;
  if (selected.has('agentBrowser') || selected.has('browserUse')) {
    const selectedDefaultIntegrations = (['agentBrowser', 'browserUse'] as const).filter(
      integration => selected.has(integration),
    );
    const currentDefaults = new Set(currentState.defaultIntegrations);
    const confirmed = await confirmDefault(
      confirmationPrompt(
        locale,
        translate(locale, 'defaultIntegrationsPrompt'),
        selectedDefaultIntegrations.every(integration => currentDefaults.has(integration)),
      ),
    );
    if (confirmed === undefined) return undefined;
    globalDefault = confirmed;
  }
  return {
    agentBrowser: selected.has('agentBrowser'),
    browserUse: selected.has('browserUse'),
    browserUseDefault: globalDefault ? 'extension' : 'direct',
    globalDefault,
    playwright: selected.has('playwright'),
    reconcileIntegrations: true,
  };
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
  if (message === '--global-default is not needed with uninstall') {
    return translate(locale, 'errorGlobalDefaultUninstall');
  }
  if (message === '--agent-browser is not needed with uninstall') {
    return translate(locale, 'errorAgentBrowserUninstall');
  }
  if (message === '--global-default requires --agent-browser or --browser-use') {
    return translate(locale, 'errorGlobalDefaultSelection');
  }
  if (message === '--browser-use is not needed with uninstall') {
    return translate(locale, 'errorBrowserUseUninstall');
  }
  if (message === '--playwright is not needed with uninstall') {
    return translate(locale, 'errorPlaywrightUninstall');
  }
  if (message === '--extension-id is not available with uninstall') {
    return translate(locale, 'errorExtensionIdUninstall');
  }
  return message;
}

function describeAdapterSource(
  registration: FetchAdapterRegistration,
  locale: SupportedLocale,
): string {
  const source = registration.source;
  if (!source) return translate(locale, 'adapterSourceUnknown');
  if (source.kind === 'builtin') {
    return translate(locale, 'adapterSourceBuiltin', { id: source.id, version: source.version });
  }
  if (source.kind === 'local') {
    return translate(locale, 'adapterSourceLocal', { path: source.path });
  }
  const selection = [
    source.ref ? `ref=${source.ref}` : '',
    source.subdirectory ? `path=${source.subdirectory}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return translate(locale, 'adapterSourceGitHub', {
    repository: source.repository,
    commit: source.commit.slice(0, 12),
    selection: selection ? ` (${selection})` : '',
  });
}

function localizedAdapterError(error: unknown, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message : String(error);
  if (locale === 'en') return translate(locale, 'adapterError', { message });
  const replacements: Array<[RegExp, string]> = [
    [/^Unknown fetch adapter source:/, '未知 Fetch 适配器来源：'],
    [/^Fetch adapter source directory is unavailable:/, 'Fetch 适配器来源目录不可用：'],
    [/^Fetch adapter source must contain /, 'Fetch 适配器来源必须包含 '],
    [
      /^GitHub repository or ref is unavailable; private repositories are unsupported:/,
      'GitHub 仓库或引用不可用；当前不支持私有仓库：',
    ],
    [/^GitHub repository is invalid/, 'GitHub 仓库标识无效'],
    [/^GitHub ref is invalid/, 'GitHub 引用无效'],
    [/^GitHub source subdirectory is invalid/, 'GitHub 来源子目录无效'],
    [/^GitHub source URL is unsafe/, 'GitHub 来源 URL 不安全'],
    [/^GitHub archive contains an unsafe path/, 'GitHub 压缩包包含不安全路径'],
    [
      /^GitHub archive contains a link or unsupported file type/,
      'GitHub 压缩包包含链接或不支持的文件类型',
    ],
    [/^GitHub archive contains an oversized file/, 'GitHub 压缩包包含超大文件'],
    [/^GitHub archive /, 'GitHub 压缩包'],
    [/^GitHub request /, 'GitHub 请求'],
  ];
  const localized = replacements.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    message,
  );
  return translate(locale, 'adapterError', { message: localized });
}

export async function main(
  argv: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  if (versionRequested(argv)) {
    console.log(`v${await packageVersion()}`);
    return 0;
  }
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

  let setupProgress: SetupProgress | undefined;
  try {
    if (parsed.operation === 'adapters') {
      const adapters = await (dependencies.listFetchAdapters ?? listFetchAdapters)({
        environment: dependencies.environment,
      });
      console.log(translate(locale, 'adapterListTitle'));
      if (adapters.length === 0) console.log(translate(locale, 'adapterNone'));
      else {
        for (const adapter of adapters) {
          console.log(
            `  ${adapter.manifest.id}@${adapter.manifest.version} — ${adapter.manifest.description} — ${describeAdapterSource(adapter, locale)}`,
          );
        }
      }
      return 0;
    }
    if (parsed.operation === 'add') {
      const sources = parsed.adapterAll ? ['all'] : (parsed.adapterItems ?? []);
      console.log(translate(locale, 'adapterTrust'));
      console.log(translate(locale, 'adapterAddProgress'));
      const installed = await (dependencies.installFetchAdapters ?? installFetchAdapters)(sources, {
        environment: dependencies.environment,
      });
      console.log(translate(locale, 'adapterInstalledTitle'));
      for (const adapter of installed) {
        console.log(
          `  ${adapter.manifest.id}@${adapter.manifest.version} — ${describeAdapterSource(adapter, locale)}`,
        );
      }
      return 0;
    }
    if (parsed.operation === 'remove') {
      const removed = await (dependencies.removeFetchAdapters ?? removeFetchAdapters)(
        parsed.adapterAll ? 'all' : (parsed.adapterItems ?? []),
        { environment: dependencies.environment },
      );
      console.log(translate(locale, 'adapterRemoved', { adapters: removed.join(', ') }));
      return 0;
    }
    if (parsed.operation === 'doctor') {
      const report = await (dependencies.doctor ?? doctorPanerelay)({
        agentBrowser: parsed.agentBrowser,
        browserUse: parsed.browserUse,
        playwright: parsed.playwright,
        environment: dependencies.environment,
        extensionId: parsed.extensionId,
        globalDefault: parsed.globalDefault,
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
      const result = await (dependencies.uninstall ?? uninstallPanerelay)({});
      console.log(translate(locale, 'uninstallComplete'));
      if (result.browserUseIntegration.detachedDaemonMayRemain) {
        console.log(translate(locale, 'browserUseDetachedDaemon'));
      }
      return 0;
    }

    let setupOptions: PanerelaySetupOptions = {
      agentBrowser: parsed.agentBrowser,
      browserUse: parsed.browserUse,
      playwright: parsed.playwright,
      environment: dependencies.environment,
      extensionId: parsed.extensionId,
      globalDefault: parsed.globalDefault,
      ...(parsed.browserUse && parsed.globalDefault
        ? { browserUseDefault: 'extension' as const }
        : {}),
    };
    let interactiveSetup = false;
    if (
      parsed.operation === 'setup' &&
      !parsed.agentBrowser &&
      !parsed.browserUse &&
      !parsed.playwright &&
      !parsed.yes &&
      (dependencies.interactive ?? isInteractiveTerminal)()
    ) {
      const currentState = await (dependencies.readInteractiveState ?? readInteractiveSetupState)({
        environment: dependencies.environment,
      });
      const selected = await selectOptionalIntegrations(
        locale,
        currentState,
        dependencies.selectIntegrations ?? promptIntegrations,
        dependencies.confirmDefault ?? promptConfirmation,
      );
      if (!selected) {
        console.error(translate(locale, 'setupCancelled'));
        return 2;
      }
      setupOptions = { ...setupOptions, ...selected };
      interactiveSetup = true;
    }
    const selectedAgentBrowser = setupOptions.agentBrowser === true;
    const selectedBrowserUse = setupOptions.browserUse === true;
    const selectedPlaywright = setupOptions.playwright === true;
    const selectedGlobalDefault = setupOptions.globalDefault === true;
    if (interactiveSetup) {
      setupProgress = dependencies.createSetupProgress?.() ?? terminalSetupProgress();
      setupProgress?.start(translate(locale, 'setupProgress'));
    }
    const result = await (dependencies.setup ?? setupPanerelay)(setupOptions);
    setupProgress?.stop(translate(locale, 'setupProgressComplete'));
    setupProgress = undefined;
    console.log(translate(locale, 'setupTitle'));

    console.log('');
    console.log(translate(locale, 'setupGroupLocal'));
    printSetupCheck('pass', translate(locale, 'setupNativeHost'), result.host.hostPath);
    printSetupCheck('pass', translate(locale, 'setupExtensionId'), result.host.extensionId);
    printSetupSubline(
      translate(locale, 'setupNextStep'),
      result.host.extensionId === PANERELAY_EXTENSION_ID
        ? translate(locale, 'extensionStoreNextStep', {
            url: PANERELAY_CHROME_WEB_STORE_URL,
          })
        : translate(locale, 'extensionCustomNextStep', { id: result.host.extensionId }),
    );

    if (selectedAgentBrowser || selectedBrowserUse || selectedPlaywright) {
      console.log('');
      console.log(translate(locale, 'setupGroupAutomation'));
    }

    if (result.removedBrowserUseIntegration?.detachedDaemonMayRemain) {
      console.log(translate(locale, 'browserUseDetachedDaemon'));
    }

    const agentBrowserReady = result.agentBrowserInstallation?.supported === true;
    if (selectedAgentBrowser) {
      const agentBrowserVersion = result.agentBrowserInstallation?.version;
      printSetupCheck(
        agentBrowserReady ? 'pass' : 'fail',
        translate(locale, 'setupAgentBrowser'),
        result.agentBrowserInstallation?.executable
          ? (agentBrowserVersion ?? 'unknown')
          : translate(locale, 'setupNotFound'),
      );
      if (selectedGlobalDefault && result.agentBrowserConfigPath) {
        printSetupSubline(translate(locale, 'setupUserDefault'), result.agentBrowserConfigPath);
      }
      if (agentBrowserReady) {
        printSetupCommand(
          translate(locale, 'agentCommand'),
          agentBrowserCommand(selectedGlobalDefault),
        );
      } else {
        printSetupSubline(
          translate(locale, 'setupFix'),
          result.agentBrowserInstallation?.executable
            ? translate(locale, 'agentBrowserUnsupported', {
                version: agentBrowserVersion ?? 'unknown',
              })
            : translate(locale, 'agentBrowserMissing'),
        );
      }
    }

    if (selectedBrowserUse) {
      const browserUseReady = result.browserUseReady === true;
      const browserUseVersion = result.browserUseVersions?.browserUse;
      printSetupCheck(
        browserUseReady ? 'pass' : 'fail',
        translate(locale, 'setupBrowserUse'),
        browserUseVersion ?? translate(locale, 'setupNotFound'),
      );
      if (result.browserUseIntegration) {
        printSetupSubline(
          translate(locale, 'setupBrowserHarnessEnvironment'),
          browserUseEnvironmentPath(undefined, dependencies.environment),
        );
        if (selectedGlobalDefault) {
          printSetupSubline(
            translate(locale, 'setupUserDefault'),
            browserUseEnvironmentPath(undefined, dependencies.environment),
          );
        }
      }
      if (browserUseReady) {
        printSetupCommand(
          translate(locale, 'setupBrowserUseCommand'),
          browserUseCommand(selectedGlobalDefault),
        );
      } else {
        printSetupSubline(translate(locale, 'setupFix'), translate(locale, 'browserUseMissing'));
      }
    }

    if (selectedPlaywright) {
      const playwrightReady = result.playwrightInstallation?.supported === true;
      printSetupCheck(
        playwrightReady ? 'pass' : 'fail',
        translate(locale, 'setupPlaywright'),
        result.playwrightInstallation?.executable
          ? (result.playwrightInstallation.version ?? 'unknown')
          : translate(locale, 'setupNotFound'),
      );
      if (result.playwrightIntegration) {
        printSetupSubline(
          translate(locale, 'setupPlaywrightConfig'),
          result.playwrightIntegration.paths.configPath,
        );
        if (playwrightReady) {
          printSetupCommand(
            translate(locale, 'setupPlaywrightCommand'),
            `playwright-cli attach --cdp ${PANERELAY_PLAYWRIGHT_GATEWAY_URL}`,
          );
        }
      }
      if (!playwrightReady) {
        printSetupSubline(translate(locale, 'setupFix'), translate(locale, 'playwrightMissing'));
      }
    }

    const setupReady =
      (!selectedAgentBrowser || agentBrowserReady) &&
      (!selectedBrowserUse || result.browserUseReady === true) &&
      (!selectedPlaywright || result.playwrightInstallation?.supported === true);
    console.log('');
    console.log(
      `${setupReady ? '✅' : '❌'} ${translate(
        locale,
        setupReady ? 'setupReady' : 'setupAttention',
      )}`,
    );
    return setupReady ? 0 : 1;
  } catch (error) {
    setupProgress?.error(translate(locale, 'setupProgressFailed'));
    console.error(
      parsed.operation === 'add' || parsed.operation === 'remove' || parsed.operation === 'adapters'
        ? localizedAdapterError(error, locale)
        : error instanceof Error
          ? error.message
          : String(error),
    );
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
