import { execFileSync } from 'node:child_process';

export type SupportedLocale = 'en' | 'zh-CN';

const englishMessages = {
  agentBrowserDefaultPrompt: 'Make Panerelay the default agent-browser Provider? [y/N] ',
  agentBrowserPrompt: 'Install the agent-browser integration? [y/N] ',
  agentBrowserMissing: 'Warning: agent-browser was not found.',
  agentBrowserUnsupported:
    'Warning: agent-browser {version} is unsupported. Panerelay requires 0.33.0 or newer.',
  agentCommand: 'Agent command:',
  agentSkill: 'Agent Skill: {path}',
  automationChoices:
    'Optional automation integrations: run setup in a terminal without flags to choose them interactively, or use --agent-browser and/or --browser-use.',
  browserUseIntegration: 'Browser Use integration: {path}',
  browserUseDefaultPrompt: 'Use Panerelay as the default Browser Use connection? [y/N] ',
  browserUsePrompt: 'Install the Browser Use integration? [y/N] ',
  browserUseMissing:
    'Warning: a complete Browser Use 0.13.7 or newer installation was not found. Install, repair, or upgrade Browser Use, then run setup again with --browser-use.',
  browserUseReady: 'Browser Use: {browserUse}',
  browserUseDetachedDaemon:
    'Browser Use integration files were removed. A detached daemon and its current browser participant may remain until the user releases it or the Extension/Native Host disconnects; Panerelay did not kill processes by name.',
  browserUseSkill: 'Browser Use Agent Skill: {path}',
  playwrightMissing: 'Warning: Playwright CLI was not found or is unsupported.',
  codexMissing: 'Warning: Codex CLI was not found.',
  doctorAttention: 'Panerelay needs attention.',
  doctorFailureCount: 'Failed checks: {count}',
  doctorFix: 'Fix',
  doctorGroupBrowser: 'Browser connection',
  doctorGroupDefaultProvider: 'Default integration',
  doctorGroupEnvironment: 'Environment',
  doctorGroupIntegration: 'Local integration',
  doctorGroupOther: 'Other checks',
  doctorReady: 'Panerelay is ready.',
  doctorRerun: 'After applying the fixes, run: npx --yes @panerelay/setup doctor',
  doctorTip: 'Tip',
  doctorTitle: 'Panerelay doctor',
  doctorWarningCount: 'Warnings: {count}',
  errorBrowserUseUninstall: '--browser-use is not needed with uninstall',
  errorGlobalDefaultSelection: '--global-default requires --agent-browser or --browser-use',
  errorAgentBrowserUninstall: '--agent-browser is not needed with uninstall',
  errorGlobalDefaultUninstall: '--global-default is not needed with uninstall',
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
  globalDefault: 'Global default configuration: {path}',
  setupAgentBrowser: 'agent-browser',
  setupAgentSkill: 'Agent Skill',
  setupBrowserHarnessEnvironment: 'Browser Harness environment',
  setupBrowserUse: 'Browser Use',
  setupBrowserUseCommand: 'Browser Use command:',
  setupBrowserUseSkill: 'Browser Use Agent Skill',
  setupPlaywright: 'Playwright CLI',
  setupPlaywrightConfig: 'Playwright config:',
  setupPlaywrightCommand: 'Playwright command:',
  setupPlaywrightSkill: 'Playwright Agent Skill',
  setupCodex: 'Codex',
  setupExtensionId: 'Extension ID',
  setupFix: 'Fix',
  setupGroupAutomation: 'Automation integrations',
  setupGroupLocal: 'Local integration',
  setupGroupOptional: 'Optional tools',
  setupNextStep: 'Next step',
  setupNotFound: 'Not found',
  setupReady: 'Panerelay setup complete.',
  setupAttention: 'Panerelay setup needs attention.',
  setupUserDefault: 'User default',
  setupNativeHost: 'Native Host',
  setupTitle: 'Panerelay setup',
  help: `Panerelay Setup

Usage:
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--playwright] [--global-default] [--extension-id <id>] [--lang <language>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--playwright] [--global-default] [--extension-id <id>] [--json] [--lang <language>]
  npx --yes @panerelay/setup uninstall [--yes] [--lang <language>]

Commands:
  setup       Install the Native Host for the Extension and side panel (default)
  doctor      Diagnose the local Panerelay integration
  uninstall   Remove Panerelay-managed local integration files

Options:
  --agent-browser      Also install or diagnose the Panerelay agent-browser integration
  --browser-use        Also install or diagnose the Panerelay Browser Use integration
  --playwright         Also install or diagnose the Panerelay Playwright CLI integration
  --global-default
              Set selected automation integrations as user-level defaults
  --extension-id
              Use a custom 32-character Chrome Extension ID for this installation
  --json      Print a machine-readable doctor report
  --lang      Use en or zh-CN instead of the system language
  --yes, -y   Confirm uninstall without a prompt
  --help, -h  Show this help

Optional automation integrations:
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use
  npx --yes @panerelay/setup --playwright`,
  nativeHost: 'Native Host: {path}',
  nonInteractiveUninstall: 'Non-interactive input detected. Re-run with --yes.',
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
  agentCommand: 'Agent 命令：',
  agentSkill: 'Agent Skill：{path}',
  automationChoices:
    '可选自动化集成：在终端中不带参数运行 setup 可交互选择，也可使用 --agent-browser 和/或 --browser-use。',
  browserUseIntegration: 'Browser Use 集成：{path}',
  browserUseDefaultPrompt: '将 Panerelay 设为 Browser Use 的默认连接吗？[y/N] ',
  browserUsePrompt: '需要接入 Browser Use 吗？[y/N] ',
  browserUseMissing:
    '警告：未找到完整的 Browser Use 0.13.7 或更高版本。请安装、修复或升级 Browser Use 后，使用 --browser-use 重新运行 setup。',
  browserUseReady: 'Browser Use：{browserUse}',
  browserUseDetachedDaemon:
    '已移除 Browser Use 集成文件。分离的 daemon 及其当前浏览器 participant 可能持续到用户主动释放，或 Extension/Native Host 断开；Panerelay 未按进程名终止进程。',
  browserUseSkill: 'Browser Use Agent Skill：{path}',
  codexMissing: '警告：未找到 Codex CLI。',
  doctorAttention: 'Panerelay 需要处理以下问题。',
  doctorFailureCount: '失败项：{count}',
  doctorFix: '修复',
  doctorGroupBrowser: '浏览器连接',
  doctorGroupDefaultProvider: '默认集成',
  doctorGroupEnvironment: '运行环境',
  doctorGroupIntegration: '本地集成',
  doctorGroupOther: '其他检查',
  doctorReady: 'Panerelay 已就绪。',
  doctorRerun: '修复后重新运行：npx --yes @panerelay/setup doctor',
  doctorTip: '提示',
  doctorTitle: 'Panerelay 诊断',
  doctorWarningCount: '警告项：{count}',
  errorBrowserUseUninstall: 'uninstall 无需使用 --browser-use',
  errorGlobalDefaultSelection: '--global-default 必须同时使用 --agent-browser 或 --browser-use',
  errorAgentBrowserUninstall: 'uninstall 无需使用 --agent-browser',
  errorGlobalDefaultUninstall: 'uninstall 无需使用 --global-default',
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
  globalDefault: '全局默认配置：{path}',
  setupAgentBrowser: 'agent-browser',
  setupAgentSkill: 'Agent Skill',
  setupBrowserHarnessEnvironment: 'Browser Harness 环境',
  setupBrowserUse: 'Browser Use',
  setupBrowserUseCommand: 'Browser Use 命令：',
  setupBrowserUseSkill: 'Browser Use Agent Skill',
  playwrightMissing: '警告：未找到或不支持 Playwright CLI。',
  setupPlaywrightConfig: 'Playwright 配置：',
  setupPlaywrightCommand: 'Playwright 命令：',
  setupPlaywrightSkill: 'Playwright Agent Skill',
  setupPlaywright: 'Playwright CLI',
  setupCodex: 'Codex',
  setupExtensionId: '扩展 ID',
  setupFix: '处理',
  setupGroupAutomation: '自动化集成',
  setupGroupLocal: '本地集成',
  setupGroupOptional: '可选工具',
  setupNextStep: '下一步',
  setupNotFound: '未找到',
  setupReady: 'Panerelay 安装完成。',
  setupAttention: 'Panerelay 安装需要处理。',
  setupUserDefault: '用户级默认值',
  setupNativeHost: 'Native Host',
  setupTitle: 'Panerelay 安装',
  help: `Panerelay 安装工具

用法：
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--playwright] [--global-default] [--extension-id <id>] [--lang <语言>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--playwright] [--global-default] [--extension-id <id>] [--json] [--lang <语言>]
  npx --yes @panerelay/setup uninstall [--yes] [--lang <语言>]

命令：
  setup       为 Extension 和侧边栏安装 Native Host（默认）
  doctor      诊断本地 Panerelay 集成
  uninstall   移除由 Panerelay 管理的本地集成文件

选项：
  --agent-browser      同时安装或诊断 Panerelay agent-browser 集成
  --browser-use        同时安装或诊断 Panerelay Browser Use 集成
  --playwright         同时安装或诊断 Panerelay Playwright CLI 集成
  --global-default
              将选中的自动化集成设为用户级默认
  --extension-id
              为当前安装指定 32 位 Chrome 扩展 ID
  --json      输出机器可读的 doctor 报告
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --yes, -y   无需确认直接卸载
  --help, -h  显示帮助

可选自动化集成：
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use
  npx --yes @panerelay/setup --playwright`,
  nativeHost: 'Native Host：{path}',
  nonInteractiveUninstall: '检测到非交互式输入，请添加 --yes 后重试。',
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
