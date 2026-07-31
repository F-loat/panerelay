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

Commands:
  browsers    List live Panerelay browser registrations
  browser use Save one live registration as the routing default
  browser clear
              Clear the saved browser default

Options:
  --lang      Use en or zh-CN instead of the system language
  --help, -h  Show this help

Occasional use without a global installation:
  npx --yes @panerelay/cli browsers`,
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

命令：
  browsers    列出在线的 Panerelay 浏览器注册
  browser use 保存一个在线注册作为路由默认浏览器
  browser clear
              清除保存的默认浏览器

选项：
  --lang      使用 en 或 zh-CN，不跟随系统语言
  --help, -h  显示帮助

无需全局安装的临时用法：
  npx --yes @panerelay/cli browsers`,
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
