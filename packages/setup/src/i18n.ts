import { execFileSync } from 'node:child_process';

export type SupportedLocale = 'en' | 'zh-CN';

const englishMessages = {
  agentBrowserMissing: 'Warning: agent-browser was not found.',
  agentCommand: 'Agent command: agent-browser --provider panerelay snapshot -i',
  agentSkill: 'Agent Skill: {path}',
  codexMissing: 'Warning: Codex CLI was not found.',
  doctorAttention: 'PaneRelay needs attention.',
  doctorReady: 'PaneRelay is ready.',
  errorGlobalProviderUninstall: '--global-provider is not needed with uninstall',
  errorJsonDoctorOnly: '--json is only available with doctor',
  errorLanguageMissing: '--lang requires a language',
  errorLanguageRepeated: '--lang can only be provided once',
  errorLanguageUnsupported: 'Unsupported language: {language}. Use en or zh-CN.',
  errorUnknownCommand: 'Unknown command: {command}',
  errorUnknownOption: 'Unknown option: {option}',
  globalProvider: 'Global default provider: {path}',
  help: `PaneRelay Setup

Usage:
  npx @panerelay/setup [setup] [--project] [--global-provider] [--lang <language>]
  npx @panerelay/setup doctor [--project] [--global-provider] [--json] [--lang <language>]
  npx @panerelay/setup uninstall [--project] [--yes] [--lang <language>]

Commands:
  setup       Install the Native Host, agent-browser provider, and Agent Skill
  doctor      Diagnose the local PaneRelay integration
  uninstall   Remove PaneRelay-managed local integration files

Options:
  --project   Also configure the current project to default to PaneRelay
  --global-provider
              Set PaneRelay as the user-level default agent-browser provider
  --json      Print a machine-readable doctor report
  --lang      Use en or zh-CN instead of the system language
  --yes, -y   Confirm uninstall without a prompt
  --help, -h  Show this help

Agent usage after setup:
  agent-browser --provider panerelay snapshot -i`,
  nativeHost: 'Native Host: {path}',
  nonInteractiveUninstall: 'Non-interactive input detected. Re-run with --yes.',
  projectProvider: 'Project provider: {path}',
  setupComplete: 'PaneRelay setup complete.',
  statusFail: 'FAIL',
  statusPass: 'PASS',
  statusWarn: 'WARN',
  uninstallCancelled: 'Uninstall cancelled.',
  uninstallComplete: 'PaneRelay local integration removed.',
  uninstallPrompt: 'Uninstall PaneRelay local integration? [y/N] ',
} as const;

type MessageKey = keyof typeof englishMessages;

const chineseMessages: Record<MessageKey, string> = {
  agentBrowserMissing: '警告：未找到 agent-browser。',
  agentCommand: 'Agent 命令：agent-browser --provider panerelay snapshot -i',
  agentSkill: 'Agent Skill：{path}',
  codexMissing: '警告：未找到 Codex CLI。',
  doctorAttention: 'PaneRelay 需要处理以下问题。',
  doctorReady: 'PaneRelay 已就绪。',
  errorGlobalProviderUninstall: 'uninstall 无需使用 --global-provider',
  errorJsonDoctorOnly: '--json 只能与 doctor 一起使用',
  errorLanguageMissing: '--lang 后需要指定语言',
  errorLanguageRepeated: '--lang 只能指定一次',
  errorLanguageUnsupported: '不支持的语言：{language}。请使用 en 或 zh-CN。',
  errorUnknownCommand: '未知命令：{command}',
  errorUnknownOption: '未知选项：{option}',
  globalProvider: '全局默认 Provider：{path}',
  help: `PaneRelay 安装工具

用法：
  npx @panerelay/setup [setup] [--project] [--global-provider] [--lang <语言>]
  npx @panerelay/setup doctor [--project] [--global-provider] [--json] [--lang <语言>]
  npx @panerelay/setup uninstall [--project] [--yes] [--lang <语言>]

命令：
  setup       安装 Native Host、agent-browser Provider 和 Agent Skill
  doctor      诊断本地 PaneRelay 集成
  uninstall   移除由 PaneRelay 管理的本地集成文件

选项：
  --project   同时将当前项目的默认 Provider 配置为 PaneRelay
  --global-provider
              将 PaneRelay 设为用户级默认 agent-browser Provider
  --json      输出机器可读的 doctor 报告
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --yes, -y   无需确认直接卸载
  --help, -h  显示帮助

安装后的 Agent 用法：
  agent-browser --provider panerelay snapshot -i`,
  nativeHost: 'Native Host：{path}',
  nonInteractiveUninstall: '检测到非交互式输入，请添加 --yes 后重试。',
  projectProvider: '项目 Provider：{path}',
  setupComplete: 'PaneRelay 安装完成。',
  statusFail: '失败',
  statusPass: '通过',
  statusWarn: '警告',
  uninstallCancelled: '已取消卸载。',
  uninstallComplete: '已移除 PaneRelay 本地集成。',
  uninstallPrompt: '确定卸载 PaneRelay 本地集成吗？[y/N] ',
};

export interface LocaleResolutionOptions {
  environment?: NodeJS.ProcessEnv;
  requestedLocale?: string;
  systemLocale?: string;
}

export function normalizeLocale(value: string | undefined): SupportedLocale | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  return undefined;
}

function macOsPreferredLanguage(): string | undefined {
  if (process.platform !== 'darwin') return undefined;
  try {
    const output = execFileSync('/usr/bin/defaults', ['read', '-g', 'AppleLanguages'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /"([^"]+)"/.exec(output)?.[1] ?? /\(\s*([^,\s)]+)/.exec(output)?.[1];
  } catch {
    return undefined;
  }
}

function detectedSystemLocale(): string | undefined {
  const macOsLanguage = macOsPreferredLanguage();
  if (macOsLanguage) return macOsLanguage;
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export function resolveLocale(options: LocaleResolutionOptions = {}): SupportedLocale {
  const environment = options.environment ?? process.env;
  return (
    normalizeLocale(options.requestedLocale) ??
    normalizeLocale(environment.PANERELAY_LANG) ??
    normalizeLocale(options.systemLocale ?? detectedSystemLocale()) ??
    normalizeLocale(environment.LC_ALL) ??
    normalizeLocale(environment.LC_MESSAGES) ??
    normalizeLocale(environment.LANG) ??
    'en'
  );
}

export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  values: Record<string, string> = {},
): string {
  const template = locale === 'zh-CN' ? chineseMessages[key] : englishMessages[key];
  return template.replaceAll(/\{([^}]+)\}/g, (_, name: string) => values[name] ?? `{${name}}`);
}
