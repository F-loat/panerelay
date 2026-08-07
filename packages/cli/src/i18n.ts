import { execFileSync } from 'node:child_process';

export type SupportedLocale = 'en' | 'zh-CN';

const englishMessages = {
  browserDefaultCleared: 'Saved browser default cleared.',
  browserDefaultMarker: 'default',
  browserDefaultSet: 'Default browser: {name} ({id})',
  browserDefaultStale: 'Saved browser default is unavailable: {id}',
  browserListEmpty: 'No live Panerelay browsers are registered.',
  browserListTitle: 'Panerelay browsers',
  browserReady: 'ready',
  browserUnavailable: 'CDP unavailable',
  connectionModeSaved: 'Default {adapter} connection mode: {mode}',
  errorAdapterIdMissing: 'connection command requires an adapter ID',
  errorAdapterModeInvalid: 'Connection mode must be direct or extension',
  errorAdapterMissing: 'Connection adapter is not installed: {adapter}',
  errorAdapterIncompatible: 'Connection adapter registration is incompatible.',
  errorAdapterUnavailable: 'Connection adapter is unavailable.',
  errorAdapterTimeout: 'Connection adapter timed out.',
  errorAdapterInvalidResponse: 'Connection adapter returned an invalid response.',
  errorBrowserUnavailable: 'The selected Panerelay browser is unavailable.',
  errorChildCommandMissing: 'run requires -- followed by the child command',
  errorGenerationChanged: 'The selected browser connection changed. Run the command again.',
  errorConnectionNotReady: 'The selected connection is not ready.',
  errorConnectionBusy: 'The selected connection is busy. Try again shortly.',
  errorOptionValueMissing: '{option} requires a value',
  errorBrowserSelectorMissing: 'browser use requires a registration ID or browser family',
  errorLanguageMissing: '--lang requires a language',
  errorLanguageRepeated: '--lang can only be provided once',
  errorLanguageUnsupported: 'Unsupported language: {language}. Use en or zh-CN.',
  errorUnknownCommand: 'Unknown command: {command}',
  errorUnknownOption: 'Unknown option: {option}',
  help: `Panerelay CLI

Usage:
  panerelay browsers [--lang <language>]
  panerelay browser use <registration-id|family> [--lang <language>]
  panerelay browser clear [--lang <language>]
  panerelay connection use <adapter-id> <direct|extension> [--lang <language>]
  panerelay connection resolve <adapter-id> [--mode <mode>] [--browser <selector>]
  panerelay <site> <command> [site arguments]
  panerelay fetch <url|site> [request or site arguments]
  panerelay run <adapter-id> [--mode <mode>] [--browser <selector>] -- <command> [arguments...]

Commands:
  browsers    List live Panerelay browser registrations
  browser use Save one live registration as the routing default
  browser clear
              Clear the saved browser default
  connection use
              Save a connection mode for one installed adapter
  connection resolve
              Resolve connection material without running an automation command
  fetch       Send a browser-backed request or explicitly run a site adapter
  run         Run the caller's command with the selected connection

Options:
  --lang      Use en or zh-CN instead of the system language
  --version, -v
              Show the version
  --help, -h  Show this help

Occasional use without a global installation:
  npx --yes @panerelay/cli browsers

Installed site adapters can run directly; use fetch for raw URLs or disambiguation.`,
} as const;

type MessageKey = keyof typeof englishMessages;

const chineseMessages: Record<MessageKey, string> = {
  browserDefaultCleared: '已清除保存的默认浏览器。',
  browserDefaultMarker: '默认',
  browserDefaultSet: '默认浏览器：{name}（{id}）',
  browserDefaultStale: '保存的默认浏览器当前不可用：{id}',
  browserListEmpty: '当前没有已注册的 Panerelay 浏览器。',
  browserListTitle: 'Panerelay 浏览器',
  browserReady: '可用',
  browserUnavailable: 'CDP 不可用',
  connectionModeSaved: '{adapter} 的默认连接模式：{mode}',
  errorAdapterIdMissing: 'connection 命令需要指定 adapter ID',
  errorAdapterModeInvalid: '连接模式必须是 direct 或 extension',
  errorAdapterMissing: '未安装连接 adapter：{adapter}',
  errorAdapterIncompatible: '连接 adapter 注册不兼容。',
  errorAdapterUnavailable: '连接 adapter 当前不可用。',
  errorAdapterTimeout: '连接 adapter 响应超时。',
  errorAdapterInvalidResponse: '连接 adapter 返回了无效响应。',
  errorBrowserUnavailable: '所选 Panerelay 浏览器当前不可用。',
  errorChildCommandMissing: 'run 需要在 -- 后指定要运行的子命令',
  errorGenerationChanged: '所选浏览器连接已变化，请重新运行命令。',
  errorConnectionNotReady: '所选连接尚未就绪。',
  errorConnectionBusy: '所选连接正忙，请稍后重试。',
  errorOptionValueMissing: '{option} 后需要指定值',
  errorBrowserSelectorMissing: 'browser use 后需要指定注册 ID 或浏览器类型',
  errorLanguageMissing: '--lang 后需要指定语言',
  errorLanguageRepeated: '--lang 只能指定一次',
  errorLanguageUnsupported: '不支持的语言：{language}。请使用 en 或 zh-CN。',
  errorUnknownCommand: '未知命令：{command}',
  errorUnknownOption: '未知选项：{option}',
  help: `Panerelay 命令行工具

用法：
  panerelay browsers [--lang <语言>]
  panerelay browser use <注册 ID|浏览器类型> [--lang <语言>]
  panerelay browser clear [--lang <语言>]
  panerelay connection use <adapter ID> <direct|extension> [--lang <语言>]
  panerelay connection resolve <adapter ID> [--mode <模式>] [--browser <选择器>]
  panerelay <站点> <命令> [站点参数]
  panerelay fetch <URL|站点> [请求或站点参数]
  panerelay run <adapter ID> [--mode <模式>] [--browser <选择器>] -- <命令> [参数...]

命令：
  browsers    列出在线的 Panerelay 浏览器注册
  browser use 保存一个在线注册作为路由默认浏览器
  browser clear
              清除保存的默认浏览器
  connection use
              保存一个已安装 adapter 的连接模式
  connection resolve
              解析连接信息，但不运行自动化命令
  fetch       发送浏览器请求或显式运行站点适配器
  run         使用所选连接运行调用者指定的命令

选项：
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --version, -v
              显示版本
  --help, -h  显示帮助

无需全局安装的临时用法：
  npx --yes @panerelay/cli browsers

已安装的站点适配器可直接运行；原始 URL 请求或命令消歧请使用 fetch。`,
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
