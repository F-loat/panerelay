import { execFileSync } from 'node:child_process';

export type SupportedLocale = 'en' | 'zh-CN';

const englishMessages = {
  adapterAddProgress: 'Resolving, validating, and installing fetch adapters...',
  adapterError: 'Fetch adapter operation failed: {message}',
  adapterInstalledTitle: 'Installed fetch adapters',
  adapterListTitle: 'Installed fetch adapters',
  adapterNone: '  (none)',
  adapterRemoved: 'Removed fetch adapters: {adapters}',
  adapterSourceBuiltin: 'built-in {id}@{version}',
  adapterSourceGitHub: 'GitHub {repository} at {commit}{selection}',
  adapterSourceLocal: 'local {path}',
  adapterSourceUnknown: 'legacy installation (source not recorded)',
  adapterTrust:
    'Trust: local and GitHub adapters run as third-party code when invoked. Inspect their source before installing.',
  agentBrowserMissing: 'Warning: agent-browser was not found.',
  agentBrowserUnsupported:
    'Warning: agent-browser {version} is unsupported. Panerelay requires 0.33.0 or newer.',
  agentCommand: 'Agent command:',
  browserUseIntegration: 'Browser Use integration: {path}',
  browserUseMissing:
    'Warning: a complete Browser Use 0.13.7 or newer installation was not found. Install, repair, or upgrade Browser Use, then run setup again with --browser-use.',
  browserUseReady: 'Browser Use: {browserUse}',
  browserUseDetachedDaemon:
    'Browser Use integration files were removed. A detached daemon and its current browser participant may remain until the user releases it or the Extension/Native Host disconnects; Panerelay did not kill processes by name.',
  confirmNo: 'No',
  confirmYes: 'Yes',
  defaultIntegrationsPrompt:
    'Make Panerelay the user default for the selected agent-browser and Browser Use integrations?',
  playwrightMissing:
    'Warning: Playwright CLI 0.1.17 or newer was not found. Install or upgrade the upstream CLI, then run setup again with --playwright.',
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
  errorPlaywrightUninstall: '--playwright is not needed with uninstall',
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
  extensionStoreNextStep: 'Extension: Install Panerelay in the Chrome Web Store: {url}',
  globalDefault: 'Global default configuration: {path}',
  globalCliInstallFailed:
    'Could not install or update the Panerelay CLI. Check npm global-install permissions and network access, then rerun setup or use --no-cli.',
  globalCliNpmUnavailable:
    'npm is unavailable, so Setup could not install the Panerelay CLI. Install npm or rerun setup with --no-cli.',
  globalCliUninstallFailed:
    'Could not remove the Setup-managed Panerelay CLI. Check npm global-install permissions and rerun uninstall, or use --keep-cli.',
  setupAgentBrowser: 'agent-browser',
  setupBrowserHarnessEnvironment: 'Browser Harness environment',
  setupBrowserUse: 'Browser Use',
  setupClaudeFetch: 'Claude Code browser fetch routing',
  setupCodexFetch: 'Codex browser fetch routing',
  setupClaudeFetchRemoved: 'Claude Code browser fetch routing removed',
  setupCodexFetchRemoved: 'Codex browser fetch routing removed',
  setupNotConfigured: 'Not configured',
  setupBrowserUseCommand: 'Browser Use command:',
  setupPlaywright: 'Playwright CLI',
  setupPlaywrightConfig: 'Playwright config:',
  setupPlaywrightCommand: 'Playwright command:',
  setupExtensionId: 'Extension ID',
  setupCli: 'Panerelay CLI',
  setupCliCommandMissing: '{version} installed, but panerelay is not on PATH',
  setupCliPreserved: '{version} (existing global installation preserved)',
  setupCliPreservedPath: 'Existing command preserved: {path}',
  setupFix: 'Fix',
  setupGroupAutomation: 'Automation integrations',
  setupGroupLocal: 'Local integration',
  setupNextStep: 'Next step',
  setupNotFound: 'Not found',
  setupProgress: 'Applying Panerelay setup changes',
  setupProgressComplete: 'Panerelay setup changes applied',
  setupProgressFailed: 'Panerelay setup failed',
  setupReady: 'Panerelay setup complete.',
  setupAttention: 'Panerelay setup needs attention.',
  setupUserDefault: 'User default',
  setupNativeHost: 'Native Host',
  setupTitle: 'Panerelay setup',
  integrationAgentBrowserHint: 'Panerelay Provider',
  integrationBrowserUseHint: 'Browser Harness connection',
  integrationPlaywrightHint: 'Explicit CDP connection',
  integrationSelectPrompt:
    'Select integrations (checked: install/update; unchecked: remove Panerelay integration)',
  help: `Panerelay Setup

Usage:
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--playwright] [--codex-fetch|--remove-codex-fetch] [--claude-fetch|--remove-claude-fetch] [--global-default] [--extension-id <id>] [--no-cli] [--lang <language>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--playwright] [--codex-fetch] [--claude-fetch] [--global-default] [--extension-id <id>] [--json] [--lang <language>]
  npx --yes @panerelay/setup uninstall [--yes] [--keep-cli] [--lang <language>]
  npx --yes @panerelay/setup add <adapter|path|github-source>... | --all
  npx --yes @panerelay/setup remove <adapter>... | --all
  npx --yes @panerelay/setup adapters

Commands:
  doctor      Diagnose the local Panerelay integration
  uninstall   Remove Panerelay-managed local integration files
  add         Install built-in, local two-file/source-form, or public GitHub fetch adapters
  remove      Remove one or more installed fetch adapters
  adapters    List installed fetch adapters

Options:
  --agent-browser      Also install or diagnose the Panerelay agent-browser integration
  --browser-use        Also install or diagnose the Panerelay Browser Use integration
  --playwright         Also install or diagnose the Panerelay Playwright CLI integration
  --codex-fetch        Route external Codex web access through Panerelay Fetch MCP
  --claude-fetch       Route external Claude Code WebFetch through Panerelay Fetch MCP
  --remove-codex-fetch Remove Panerelay-owned external Codex fetch routing
  --remove-claude-fetch
              Remove Panerelay-owned external Claude Code fetch routing
  --global-default
              Set selected automation integrations as user-level defaults
  --extension-id
              Use a custom 32-character Chrome Extension ID for this installation
  --json      Print a machine-readable doctor report
  --no-cli    Do not install or update the global Panerelay CLI during setup
  --keep-cli  Keep a Setup-managed global Panerelay CLI during uninstall
  --lang      Use en or zh-CN instead of the system language
  --yes, -y   Confirm uninstall without a prompt
  --version, -v
              Show the version
  --help, -h  Show this help

Optional automation integrations:
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use
  npx --yes @panerelay/setup --playwright
  npx --yes @panerelay/setup --codex-fetch
  npx --yes @panerelay/setup --claude-fetch
  npx --yes @panerelay/setup --remove-codex-fetch
  npx --yes @panerelay/setup --remove-claude-fetch

Optional fetch adapters:
  npx --yes @panerelay/setup add bilibili
  npx --yes @panerelay/setup add zhihu@main
  npx --yes @panerelay/setup add --all
  npx --yes @panerelay/setup add ./my-site
  npx --yes @panerelay/setup add owner/repository
  npx --yes @panerelay/setup add 'F-loat/panerelay#zhihu'
  npx --yes @panerelay/setup add github:owner/repository@v1.0.0#sites/example
  npx --yes @panerelay/setup add 'https://github.com/owner/repository?ref=v1.0.0&path=sites/example'
  npx --yes @panerelay/setup remove bilibili`,
  nativeHost: 'Native Host: {path}',
  nonInteractiveUninstall: 'Non-interactive input detected. Re-run with --yes.',
  setupComplete: 'Panerelay setup complete.',
  setupCancelled: 'Setup cancelled.',
  uninstallCancelled: 'Uninstall cancelled.',
  uninstallComplete: 'Panerelay local integration removed.',
  uninstallPrompt: 'Uninstall Panerelay local integration?',
} as const;

type MessageKey = keyof typeof englishMessages;

const chineseMessages: Record<MessageKey, string> = {
  adapterAddProgress: '正在解析、验证并安装 Fetch 适配器……',
  adapterError: 'Fetch 适配器操作失败：{message}',
  adapterInstalledTitle: '已安装 Fetch 适配器',
  adapterListTitle: '已安装的 Fetch 适配器',
  adapterNone: '  （无）',
  adapterRemoved: '已移除 Fetch 适配器：{adapters}',
  adapterSourceBuiltin: '内置 {id}@{version}',
  adapterSourceGitHub: 'GitHub {repository}，提交 {commit}{selection}',
  adapterSourceLocal: '本地 {path}',
  adapterSourceUnknown: '旧版安装（未记录来源）',
  adapterTrust: '信任提示：本地和 GitHub 适配器在调用时会作为第三方代码运行，请在安装前检查源码。',
  agentBrowserMissing: '警告：未找到 agent-browser。',
  agentBrowserUnsupported:
    '警告：agent-browser {version} 不受支持。Panerelay 需要 0.33.0 或更高版本。',
  agentCommand: 'Agent 命令：',
  browserUseIntegration: 'Browser Use 集成：{path}',
  browserUseMissing:
    '警告：未找到完整的 Browser Use 0.13.7 或更高版本。请安装、修复或升级 Browser Use 后，使用 --browser-use 重新运行 setup。',
  browserUseReady: 'Browser Use：{browserUse}',
  browserUseDetachedDaemon:
    '已移除 Browser Use 集成文件。分离的 daemon 及其当前浏览器 participant 可能持续到用户主动释放，或 Extension/Native Host 断开；Panerelay 未按进程名终止进程。',
  confirmNo: '否',
  confirmYes: '是',
  defaultIntegrationsPrompt:
    '将 Panerelay 设为所选 agent-browser 和 Browser Use 集成的用户级默认吗？',
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
  errorPlaywrightUninstall: 'uninstall 无需使用 --playwright',
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
  globalCliInstallFailed:
    '无法安装或更新 Panerelay CLI。请检查 npm 全局安装权限和网络后重新运行 setup，或使用 --no-cli。',
  globalCliNpmUnavailable:
    '未找到 npm，Setup 无法安装 Panerelay CLI。请安装 npm，或使用 --no-cli 重新运行 setup。',
  globalCliUninstallFailed:
    '无法移除由 Setup 管理的 Panerelay CLI。请检查 npm 全局安装权限后重新运行 uninstall，或使用 --keep-cli。',
  setupAgentBrowser: 'agent-browser',
  setupBrowserHarnessEnvironment: 'Browser Harness 环境',
  setupBrowserUse: 'Browser Use',
  setupClaudeFetch: 'Claude Code 浏览器 Fetch 路由',
  setupCodexFetch: 'Codex 浏览器 Fetch 路由',
  setupClaudeFetchRemoved: '已移除 Claude Code 浏览器 Fetch 路由',
  setupCodexFetchRemoved: '已移除 Codex 浏览器 Fetch 路由',
  setupNotConfigured: '未配置',
  setupBrowserUseCommand: 'Browser Use 命令：',
  playwrightMissing:
    '警告：未找到 Playwright CLI 0.1.17 或更高版本。请安装或升级上游 CLI 后，使用 --playwright 重新运行 setup。',
  setupPlaywrightConfig: 'Playwright 配置：',
  setupPlaywrightCommand: 'Playwright 命令：',
  setupPlaywright: 'Playwright CLI',
  setupExtensionId: '扩展 ID',
  setupCli: 'Panerelay CLI',
  setupCliCommandMissing: '已安装 {version}，但 PATH 中找不到 panerelay',
  setupCliPreserved: '{version}（保留已有全局安装）',
  setupCliPreservedPath: '已保留现有命令：{path}',
  setupFix: '处理',
  setupGroupAutomation: '自动化集成',
  setupGroupLocal: '本地集成',
  setupNextStep: '下一步',
  setupNotFound: '未找到',
  setupProgress: '正在应用 Panerelay 安装变更',
  setupProgressComplete: 'Panerelay 安装变更已应用',
  setupProgressFailed: 'Panerelay 安装失败',
  setupReady: 'Panerelay 安装完成。',
  setupAttention: 'Panerelay 安装需要处理。',
  setupUserDefault: '用户级默认值',
  setupNativeHost: 'Native Host',
  setupTitle: 'Panerelay 安装',
  integrationAgentBrowserHint: 'Panerelay Provider',
  integrationBrowserUseHint: 'Browser Harness 连接',
  integrationPlaywrightHint: '显式 CDP 连接',
  integrationSelectPrompt: '选择集成（勾选：安装或更新；未勾选：移除 Panerelay 集成）',
  help: `Panerelay 安装工具

用法：
  npx --yes @panerelay/setup [--agent-browser] [--browser-use] [--playwright] [--codex-fetch|--remove-codex-fetch] [--claude-fetch|--remove-claude-fetch] [--global-default] [--extension-id <id>] [--no-cli] [--lang <语言>]
  npx --yes @panerelay/setup doctor [--agent-browser] [--browser-use] [--playwright] [--codex-fetch] [--claude-fetch] [--global-default] [--extension-id <id>] [--json] [--lang <语言>]
  npx --yes @panerelay/setup uninstall [--yes] [--keep-cli] [--lang <语言>]
  npx --yes @panerelay/setup add <适配器|路径|GitHub 来源>... | --all
  npx --yes @panerelay/setup remove <适配器>... | --all
  npx --yes @panerelay/setup adapters

命令：
  doctor      诊断本地 Panerelay 集成
  uninstall   移除由 Panerelay 管理的本地集成文件
  add         安装内置、本地两文件/源码格式或公开 GitHub Fetch 适配器
  remove      移除一个或多个已安装的 Fetch 适配器
  adapters    列出已安装的 Fetch 适配器

选项：
  --agent-browser      同时安装或诊断 Panerelay agent-browser 集成
  --browser-use        同时安装或诊断 Panerelay Browser Use 集成
  --playwright         同时安装或诊断 Panerelay Playwright CLI 集成
  --codex-fetch        将外部 Codex 网络访问路由到 Panerelay Fetch MCP
  --claude-fetch       将外部 Claude Code WebFetch 路由到 Panerelay Fetch MCP
  --remove-codex-fetch 移除 Panerelay 管理的外部 Codex Fetch 路由
  --remove-claude-fetch
              移除 Panerelay 管理的外部 Claude Code Fetch 路由
  --global-default
              将选中的自动化集成设为用户级默认
  --extension-id
              为当前安装指定 32 位 Chrome 扩展 ID
  --json      输出机器可读的 doctor 报告
  --no-cli    setup 时不安装或更新全局 Panerelay CLI
  --keep-cli  uninstall 时保留由 Setup 管理的全局 Panerelay CLI
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --yes, -y   无需确认直接卸载
  --version, -v
              显示版本
  --help, -h  显示帮助

可选自动化集成：
  npx --yes @panerelay/setup --agent-browser
  npx --yes @panerelay/setup --browser-use
  npx --yes @panerelay/setup --playwright
  npx --yes @panerelay/setup --codex-fetch
  npx --yes @panerelay/setup --claude-fetch
  npx --yes @panerelay/setup --remove-codex-fetch
  npx --yes @panerelay/setup --remove-claude-fetch

可选 Fetch 适配器：
  npx --yes @panerelay/setup add bilibili
  npx --yes @panerelay/setup add zhihu@main
  npx --yes @panerelay/setup add --all
  npx --yes @panerelay/setup add ./my-site
  npx --yes @panerelay/setup add owner/repository
  npx --yes @panerelay/setup add 'F-loat/panerelay#zhihu'
  npx --yes @panerelay/setup add github:owner/repository@v1.0.0#sites/example
  npx --yes @panerelay/setup add 'https://github.com/owner/repository?ref=v1.0.0&path=sites/example'
  npx --yes @panerelay/setup remove bilibili`,
  nativeHost: 'Native Host：{path}',
  nonInteractiveUninstall: '检测到非交互式输入，请添加 --yes 后重试。',
  setupComplete: 'Panerelay 安装完成。',
  setupCancelled: '已取消安装。',
  uninstallCancelled: '已取消卸载。',
  uninstallComplete: '已移除 Panerelay 本地集成。',
  uninstallPrompt: '确定卸载 Panerelay 本地集成吗？',
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
