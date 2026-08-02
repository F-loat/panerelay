import { execFileSync } from 'node:child_process';

export type SupportedLocale = 'en' | 'zh-CN';

const englishMessages = {
  agentBrowserDefaultPrompt: 'Make Panerelay the default agent-browser Provider? [y/N] ',
  agentBrowserPrompt: 'Install the agent-browser integration? [y/N] ',
  agentBrowserMissing: 'Warning: agent-browser was not found.',
  agentBrowserUnsupported:
    'Warning: agent-browser {version} is unsupported. Panerelay requires 0.33.0 or newer.',
  agentCommand: 'Agent command: agent-browser --provider panerelay tab list',
  agentSkill: 'Agent Skill: {path}',
  automationChoices:
    'Optional automation integrations: run setup in a terminal without flags to choose them interactively, or use --agent-browser and/or --browser-use.',
  browserUseIntegration: 'Browser Use integration: {path}',
  browserUseDefaultPrompt: 'Use Panerelay as the default Browser Use connection? [y/N] ',
  browserUseMcp: 'Optional Browser Use CLI MCP command: {path}',
  browserUsePrompt: 'Install the Browser Use integration? [y/N] ',
  browserUseMissing:
    'Warning: a complete Browser Use 0.13.7 or newer installation was not found. Install, repair, or upgrade Browser Use, then run setup again with --browser-use.',
  browserUseReady: 'Browser Use: {browserUse}',
  browserUseDetachedDaemon:
    'Browser Use private runtime state was removed. A detached daemon and its current browser participant may remain until the user releases it or the Extension/Native Host disconnects; Panerelay did not kill processes by name.',
  browserUseSkill: 'Browser Use Agent Skill: {path}',
  claudeMissing: 'Warning: a supported Claude Code CLI was not found (optional).',
  codexMissing: 'Warning: Codex CLI was not found.',
  doctorAttention: 'Panerelay needs attention.',
  doctorFailureCount: 'Failed checks: {count}',
  doctorFix: 'Fix',
  doctorGroupBrowser: 'Browser connection',
  doctorGroupDefaultProvider: 'Default Provider',
  doctorGroupEnvironment: 'Environment',
  doctorGroupIntegration: 'Local integration',
  doctorGroupOther: 'Other checks',
  doctorReady: 'Panerelay is ready.',
  doctorRerun: 'After applying the fixes, run: npx --yes @panerelay/setup doctor',
  doctorTip: 'Tip',
  doctorTitle: 'Panerelay doctor',
  doctorWarningCount: 'Warnings: {count}',
  errorBrowserUseUninstall: '--browser-use is not needed with uninstall',
  errorAgentBrowserRequired:
    '--agent-browser is required with --project-provider or --global-provider',
  errorAgentBrowserUninstall: '--agent-browser is not needed with uninstall',
  errorGlobalProviderUninstall: '--global-provider is not needed with uninstall',
  errorExtensionIdMissing: '--extension-id requires a Chrome Extension ID',
  errorExtensionIdRepeated: '--extension-id can only be provided once',
  errorExtensionIdUninstall: '--extension-id is not available with uninstall',
  errorJsonDoctorOnly: '--json is only available with doctor',
  errorLanguageMissing: '--lang requires a language',
  errorLanguageRepeated: '--lang can only be provided once',
  errorLanguageUnsupported: 'Unsupported language: {language}. Use en or zh-CN.',
  errorUnknownCommand: 'Unknown command: {command}',
  errorUnknownOption: 'Unknown option: {option}',
  extensionCustomNextStep: 'Extension: Load the build matching ID {id}, then open its side panel.',
  extensionIdentity: 'Extension ID: {id}',
  extensionStoreNextStep: 'Extension: Install or open Panerelay in the Chrome Web Store: {url}',
  globalProvider: 'Global default provider: {path}',
  help: `Panerelay Setup

Usage:
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--project-provider] [--global-provider] [--extension-id <id>] [--lang <language>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--project-provider] [--global-provider] [--extension-id <id>] [--json] [--lang <language>]
  npx --yes @panerelay/setup uninstall [--project-provider] [--yes] [--lang <language>]

Commands:
  setup       Install the Native Host for the Extension and side panel (default)
  doctor      Diagnose the local Panerelay integration
  uninstall   Remove Panerelay-managed local integration files

Options:
  --agent-browser      Also install or diagnose the Panerelay agent-browser integration
  --browser-use        Also install or diagnose the Panerelay Browser Use integration
  --project-provider   Also configure the current project to default to Panerelay (requires --agent-browser)
  --global-provider
              Set Panerelay as the user-level default agent-browser provider (requires --agent-browser)
  --extension-id
              Use a custom 32-character Chrome Extension ID for this installation
  --json      Print a machine-readable doctor report
  --lang      Use en or zh-CN instead of the system language
  --yes, -y   Confirm uninstall without a prompt
  --help, -h  Show this help

Optional automation integrations:
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use`,
  nativeHost: 'Native Host: {path}',
  nonInteractiveUninstall: 'Non-interactive input detected. Re-run with --yes.',
  projectProvider: 'Project provider: {path}',
  setupComplete: 'Panerelay setup complete.',
  uninstallCancelled: 'Uninstall cancelled.',
  uninstallComplete: 'Panerelay local integration removed.',
  uninstallPrompt: 'Uninstall Panerelay local integration? [y/N] ',
} as const;

type MessageKey = keyof typeof englishMessages;

const chineseMessages: Record<MessageKey, string> = {
  agentBrowserDefaultPrompt: '将 Panerelay 设为 agent-browser 的默认 Provider 吗？[y/N] ',
  agentBrowserPrompt: '需要接入 agent-browser 吗？[y/N] ',
  agentBrowserMissing: '警告：未找到 agent-browser。',
  agentBrowserUnsupported:
    '警告：agent-browser {version} 不受支持。Panerelay 需要 0.33.0 或更高版本。',
  agentCommand: 'Agent 命令：agent-browser --provider panerelay tab list',
  agentSkill: 'Agent Skill：{path}',
  automationChoices:
    '可选自动化集成：在终端中不带参数运行 setup 可交互选择，也可使用 --agent-browser 和/或 --browser-use。',
  browserUseIntegration: 'Browser Use 集成：{path}',
  browserUseDefaultPrompt: '将 Panerelay 设为 Browser Use 的默认连接吗？[y/N] ',
  browserUseMcp: '可选 Browser Use CLI MCP 命令：{path}',
  browserUsePrompt: '需要接入 Browser Use 吗？[y/N] ',
  browserUseMissing:
    '警告：未找到完整的 Browser Use 0.13.7 或更高版本。请安装、修复或升级 Browser Use 后，使用 --browser-use 重新运行 setup。',
  browserUseReady: 'Browser Use：{browserUse}',
  browserUseDetachedDaemon:
    '已移除 Browser Use 私有运行状态。分离的 daemon 及其当前浏览器 participant 可能持续到用户主动释放，或 Extension/Native Host 断开；Panerelay 未按进程名终止进程。',
  browserUseSkill: 'Browser Use Agent Skill：{path}',
  claudeMissing: '警告：未找到受支持的 Claude Code CLI（可选）。',
  codexMissing: '警告：未找到 Codex CLI。',
  doctorAttention: 'Panerelay 需要处理以下问题。',
  doctorFailureCount: '失败项：{count}',
  doctorFix: '修复',
  doctorGroupBrowser: '浏览器连接',
  doctorGroupDefaultProvider: '默认 Provider',
  doctorGroupEnvironment: '运行环境',
  doctorGroupIntegration: '本地集成',
  doctorGroupOther: '其他检查',
  doctorReady: 'Panerelay 已就绪。',
  doctorRerun: '修复后重新运行：npx --yes @panerelay/setup doctor',
  doctorTip: '提示',
  doctorTitle: 'Panerelay 诊断',
  doctorWarningCount: '警告项：{count}',
  errorBrowserUseUninstall: 'uninstall 无需使用 --browser-use',
  errorAgentBrowserRequired: '--project-provider 或 --global-provider 必须同时使用 --agent-browser',
  errorAgentBrowserUninstall: 'uninstall 无需使用 --agent-browser',
  errorGlobalProviderUninstall: 'uninstall 无需使用 --global-provider',
  errorExtensionIdMissing: '--extension-id 后需要指定 Chrome 扩展 ID',
  errorExtensionIdRepeated: '--extension-id 只能指定一次',
  errorExtensionIdUninstall: 'uninstall 不支持 --extension-id',
  errorJsonDoctorOnly: '--json 只能与 doctor 一起使用',
  errorLanguageMissing: '--lang 后需要指定语言',
  errorLanguageRepeated: '--lang 只能指定一次',
  errorLanguageUnsupported: '不支持的语言：{language}。请使用 en 或 zh-CN。',
  errorUnknownCommand: '未知命令：{command}',
  errorUnknownOption: '未知选项：{option}',
  extensionCustomNextStep: '扩展：请加载与 ID {id} 匹配的构建，然后打开其侧边栏。',
  extensionIdentity: '扩展 ID：{id}',
  extensionStoreNextStep: '扩展：请从 Chrome 应用商店安装或打开 Panerelay：{url}',
  globalProvider: '全局默认 Provider：{path}',
  help: `Panerelay 安装工具

用法：
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--project-provider] [--global-provider] [--extension-id <id>] [--lang <语言>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--project-provider] [--global-provider] [--extension-id <id>] [--json] [--lang <语言>]
  npx --yes @panerelay/setup uninstall [--project-provider] [--yes] [--lang <语言>]

命令：
  setup       为 Extension 和侧边栏安装 Native Host（默认）
  doctor      诊断本地 Panerelay 集成
  uninstall   移除由 Panerelay 管理的本地集成文件

选项：
  --agent-browser      同时安装或诊断 Panerelay agent-browser 集成
  --browser-use        同时安装或诊断 Panerelay Browser Use 集成
  --project-provider   同时将当前项目的默认 Provider 配置为 Panerelay（需要 --agent-browser）
  --global-provider
              将 Panerelay 设为用户级默认 agent-browser Provider（需要 --agent-browser）
  --extension-id
              为当前安装指定 32 位 Chrome 扩展 ID
  --json      输出机器可读的 doctor 报告
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --yes, -y   无需确认直接卸载
  --help, -h  显示帮助

可选自动化集成：
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use`,
  nativeHost: 'Native Host：{path}',
  nonInteractiveUninstall: '检测到非交互式输入，请添加 --yes 后重试。',
  projectProvider: '项目 Provider：{path}',
  setupComplete: 'Panerelay 安装完成。',
  uninstallCancelled: '已取消卸载。',
  uninstallComplete: '已移除 Panerelay 本地集成。',
  uninstallPrompt: '确定卸载 Panerelay 本地集成吗？[y/N] ',
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
