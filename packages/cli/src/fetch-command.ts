import {
  PANERELAY_BROWSER_ENV,
  PANERELAY_BROWSER_ID_ENV,
  selectBrowserFetchRegistration,
  type BrowserSelection,
  type BrowserRegistryOptions,
} from '@panerelay/browser-registry';
import {
  PANERELAY_FETCH_METHODS,
  isBrowserFetchRequest,
  type BrowserFetchMethod,
  type BrowserFetchRequest,
  type BrowserFetchResponseType,
  type FetchAdapterArgument,
  type FetchAdapterCommand,
  type FetchAdapterManifest,
  type FetchAdapterRegistration,
  type FetchAdapterRegistry,
} from '@panerelay/protocol';
import {
  createBrowserFetchSession,
  releaseBrowserFetchSession,
  runBrowserFetch,
  type BrowserFetchClientOptions,
} from './browser-fetch-client.js';
import { dispatchFetchAdapter } from './fetch-adapter-dispatcher.js';
import {
  readFetchAdapterRegistration,
  readFetchAdapterRegistry,
  type FetchAdapterRegistryOptions,
} from './fetch-adapter-registry.js';
import type { SupportedLocale } from './i18n.js';

export interface ParsedRawFetch {
  browserSelector?: string;
  request: BrowserFetchRequest;
}

export interface FetchCommandDependencies {
  createBrowserFetchSession?: typeof createBrowserFetchSession;
  dispatchFetchAdapter?: typeof dispatchFetchAdapter;
  readFetchAdapterRegistration?: typeof readFetchAdapterRegistration;
  readFetchAdapterRegistry?: typeof readFetchAdapterRegistry;
  releaseBrowserFetchSession?: typeof releaseBrowserFetchSession;
  runBrowserFetch?: typeof runBrowserFetch;
  selectBrowserFetchRegistration?: (options?: BrowserRegistryOptions) => Promise<BrowserSelection>;
  now?: () => number;
}

export interface FetchCommandOptions {
  dependencies?: FetchCommandDependencies;
  environment?: NodeJS.ProcessEnv;
  locale: SupportedLocale;
}

function localized(locale: SupportedLocale, english: string, chinese: string): string {
  return locale === 'zh-CN' ? chinese : english;
}

function fetchHelp(locale: SupportedLocale, registry: FetchAdapterRegistry): string {
  const adapters = registry.adapters.length
    ? registry.adapters
        .map(adapter => `  ${adapter.manifest.id.padEnd(16)}${adapter.manifest.description}`)
        .join('\n')
    : localized(locale, '  (none installed)', '  （尚未安装）');
  return localized(
    locale,
    `Panerelay browser fetch

Usage:
  panerelay fetch <url> [options]
  panerelay fetch <site> <command> [arguments]
  panerelay fetch <site> --help

Raw fetch options:
  --method <method>               GET, POST, PUT, DELETE, PATCH, HEAD, or OPTIONS
  --header, -H <name:value>       Add a request header; repeatable
  --query <name:value>            Append a query value; repeatable
  --data <text>                   Send a UTF-8 body
  --data-base64 <base64>          Send a Base64 body
  --response <type>               auto, json, text, or base64
  --timeout <ms>                  100 through 120000
  --cookies | --no-cookies        Include browser cookies (default: include)
  --browser <selector>            Select one live Panerelay browser
  --help, -h                      Show help without connecting to a browser

Adapter invocation options:
  --json                          Print the adapter result as JSON instead of a table
  --browser <selector>            Select one live Panerelay browser

Installed site adapters:
${adapters}

Manage adapters with @panerelay/setup add, remove, and adapters.`,
    `Panerelay 浏览器 Fetch

用法：
  panerelay fetch <URL> [选项]
  panerelay fetch <站点> <命令> [参数]
  panerelay fetch <站点> --help

原始 Fetch 选项：
  --method <方法>                 GET、POST、PUT、DELETE、PATCH、HEAD 或 OPTIONS
  --header, -H <名称:值>          添加请求头，可重复
  --query <名称:值>               追加查询参数，可重复
  --data <文本>                   发送 UTF-8 请求体
  --data-base64 <base64>          发送 Base64 请求体
  --response <类型>               auto、json、text 或 base64
  --timeout <毫秒>                100 到 120000
  --cookies | --no-cookies        携带浏览器 Cookie（默认携带）
  --browser <选择器>              选择一个在线 Panerelay 浏览器
  --help, -h                      不连接浏览器并显示帮助

适配器调用选项：
  --json                          使用 JSON 输出适配器结果，不渲染表格
  --browser <选择器>              选择一个在线 Panerelay 浏览器

已安装站点适配器：
${adapters}

使用 @panerelay/setup 的 add、remove 和 adapters 管理适配器。`,
  );
}

function siteHelp(locale: SupportedLocale, manifest: FetchAdapterManifest): string {
  const commands = manifest.commands
    .map(command => `  ${command.name.padEnd(16)}${command.description}`)
    .join('\n');
  return `${manifest.name} (${manifest.id})\n\n${manifest.description}\n\n${localized(
    locale,
    'Usage:',
    '用法：',
  )}\n  panerelay fetch ${manifest.id} <command> [arguments] [--json]\n\n${localized(
    locale,
    'Commands:',
    '命令：',
  )}\n${commands}\n\n${localized(locale, 'Options:', '选项：')}
  --json               ${localized(locale, 'Print JSON instead of a table', '使用 JSON 输出，不渲染表格')}
  --browser <selector> ${localized(locale, 'Select one live Panerelay browser', '选择一个在线 Panerelay 浏览器')}`;
}

function commandHelp(
  locale: SupportedLocale,
  manifest: FetchAdapterManifest,
  command: FetchAdapterCommand,
): string {
  const positional = command.args.filter(argument => argument.positional);
  const usageArguments = [
    ...positional.map(argument =>
      argument.required ? `<${argument.name}>` : `[${argument.name}]`,
    ),
    '[options]',
  ].join(' ');
  const argumentLines = command.args.length
    ? command.args
        .map(argument => {
          const label = argument.positional ? argument.name : `--${argument.name}`;
          return `  ${label.padEnd(20)}${argument.description}`;
        })
        .join('\n')
    : localized(locale, '  (none)', '  （无）');
  return `${manifest.name}: ${command.name}\n\n${command.description}\n\n${localized(
    locale,
    'Usage:',
    '用法：',
  )}\n  panerelay fetch ${manifest.id} ${command.name}${usageArguments ? ` ${usageArguments}` : ''}\n\n${localized(
    locale,
    'Arguments:',
    '参数：',
  )}\n${argumentLines}\n\n${localized(locale, 'Options:', '选项：')}
  --json               ${localized(locale, 'Print JSON instead of a table', '使用 JSON 输出，不渲染表格')}
  --browser <selector> ${localized(locale, 'Select one live Panerelay browser', '选择一个在线 Panerelay 浏览器')}\n\n${localized(locale, 'Output fields:', '输出字段：')}
  ${command.output.join(', ')}\n\n${localized(locale, 'Examples:', '示例：')}\n${command.examples
    .map(example => `  ${example}`)
    .join('\n')}`;
}

function optionValue(
  argv: string[],
  index: number,
): { consumed: number; option: string; value?: string } {
  const argument = argv[index]!;
  const separator = argument.indexOf('=');
  if (separator >= 0) {
    return {
      consumed: 1,
      option: argument.slice(0, separator),
      value: argument.slice(separator + 1),
    };
  }
  return { consumed: 2, option: argument, value: argv[index + 1] };
}

function requiredOptionValue(
  locale: SupportedLocale,
  argv: string[],
  index: number,
): { consumed: number; option: string; value: string } {
  const parsed = optionValue(argv, index);
  if (parsed.value === undefined) {
    throw new Error(
      localized(locale, `${parsed.option} requires a value`, `${parsed.option} 后需要指定值`),
    );
  }
  return { ...parsed, value: parsed.value };
}

function splitPair(locale: SupportedLocale, option: string, value: string): [string, string] {
  const separator = value.indexOf(':');
  if (separator <= 0) {
    throw new Error(
      localized(locale, `${option} requires name:value`, `${option} 需要使用“名称:值”格式`),
    );
  }
  return [value.slice(0, separator).trim(), value.slice(separator + 1).trimStart()];
}

function absoluteHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseRawFetchArguments(
  argv: string[],
  locale: SupportedLocale = 'en',
): ParsedRawFetch {
  const url = argv[0];
  if (!url || !absoluteHttpUrl(url)) {
    throw new Error(
      localized(
        locale,
        'Raw fetch requires an absolute HTTP(S) URL',
        '原始 Fetch 需要绝对 HTTP(S) URL',
      ),
    );
  }
  const request: BrowserFetchRequest = { url };
  let browserSelector: string | undefined;
  let bodySeen = false;
  let cookiesSeen: boolean | undefined;
  for (let index = 1; index < argv.length;) {
    const argument = argv[index]!;
    if (argument === '--cookies' || argument === '--no-cookies') {
      const value = argument === '--cookies';
      if (cookiesSeen !== undefined && cookiesSeen !== value) {
        throw new Error(
          localized(
            locale,
            '--cookies and --no-cookies cannot be combined',
            '--cookies 与 --no-cookies 不能同时使用',
          ),
        );
      }
      cookiesSeen = value;
      request.withCookies = value;
      index += 1;
      continue;
    }
    const parsed = requiredOptionValue(locale, argv, index);
    index += parsed.consumed;
    if (parsed.option === '--method') {
      const method = parsed.value.toUpperCase();
      if (!PANERELAY_FETCH_METHODS.includes(method as BrowserFetchMethod)) {
        throw new Error(
          localized(
            locale,
            `Unsupported fetch method: ${parsed.value}`,
            `不支持的 Fetch 方法：${parsed.value}`,
          ),
        );
      }
      request.method = method as BrowserFetchMethod;
    } else if (parsed.option === '--header' || parsed.option === '-H') {
      const [name, value] = splitPair(locale, parsed.option, parsed.value);
      if (name.toLowerCase() === 'cookie') {
        throw new Error(
          localized(
            locale,
            'Cookie headers are not accepted; use browser cookies or --no-cookies',
            '不接受 Cookie 请求头；请使用浏览器 Cookie 或 --no-cookies',
          ),
        );
      }
      request.headers = { ...(request.headers ?? {}), [name]: value };
    } else if (parsed.option === '--query') {
      const [name, value] = splitPair(locale, parsed.option, parsed.value);
      request.query = [...(request.query ?? []), { name, value }];
    } else if (parsed.option === '--data' || parsed.option === '--data-base64') {
      if (bodySeen)
        throw new Error(
          localized(locale, 'Only one request body may be provided', '只能指定一种请求体'),
        );
      bodySeen = true;
      request.body = {
        encoding: parsed.option === '--data' ? 'utf8' : 'base64',
        data: parsed.value,
      };
    } else if (parsed.option === '--response') {
      if (!['auto', 'json', 'text', 'base64'].includes(parsed.value)) {
        throw new Error(
          localized(
            locale,
            `Unsupported response type: ${parsed.value}`,
            `不支持的响应类型：${parsed.value}`,
          ),
        );
      }
      request.responseType = parsed.value as BrowserFetchResponseType;
    } else if (parsed.option === '--timeout') {
      request.timeoutMs = Number(parsed.value);
    } else if (parsed.option === '--browser') {
      if (!parsed.value)
        throw new Error(localized(locale, '--browser requires a value', '--browser 后需要指定值'));
      if (browserSelector)
        throw new Error(
          localized(locale, '--browser can only be provided once', '--browser 只能指定一次'),
        );
      browserSelector = parsed.value;
    } else {
      throw new Error(
        localized(
          locale,
          `Unknown fetch option: ${parsed.option}`,
          `未知 Fetch 选项：${parsed.option}`,
        ),
      );
    }
  }
  if (!isBrowserFetchRequest(request)) {
    throw new Error(
      localized(
        locale,
        'Invalid or out-of-bounds browser fetch request',
        '浏览器 Fetch 请求无效或超出限制',
      ),
    );
  }
  return { request, ...(browserSelector ? { browserSelector } : {}) };
}

function selectionEnvironment(
  environment: NodeJS.ProcessEnv | undefined,
  selector: string | undefined,
): NodeJS.ProcessEnv {
  return {
    ...(environment ?? process.env),
    ...(selector
      ? { [PANERELAY_BROWSER_ID_ENV]: undefined, [PANERELAY_BROWSER_ENV]: selector }
      : {}),
  };
}

function extractAdapterInvocationOptions(
  argv: string[],
  locale: SupportedLocale,
): { argv: string[]; browserSelector?: string; json: boolean } {
  const remaining: string[] = [];
  let browserSelector: string | undefined;
  let json = false;
  for (let index = 0; index < argv.length;) {
    const argument = argv[index]!;
    if (argument === '--json') {
      if (json)
        throw new Error(
          localized(locale, '--json can only be provided once', '--json 只能指定一次'),
        );
      json = true;
      index += 1;
      continue;
    }
    if (argument.startsWith('--json=')) {
      throw new Error(localized(locale, '--json does not accept a value', '--json 不接受参数值'));
    }
    if (argument !== '--browser' && !argument.startsWith('--browser=')) {
      remaining.push(argument);
      index += 1;
      continue;
    }
    const parsed = requiredOptionValue(locale, argv, index);
    if (browserSelector)
      throw new Error(
        localized(locale, '--browser can only be provided once', '--browser 只能指定一次'),
      );
    browserSelector = parsed.value;
    index += parsed.consumed;
  }
  return { argv: remaining, json, ...(browserSelector ? { browserSelector } : {}) };
}

function tableCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const rendered =
    typeof value === 'object' ? (JSON.stringify(value) ?? String(value)) : String(value);
  return rendered.replaceAll('\r', '\\r').replaceAll('\n', '\\n');
}

function tableWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint === 0 ||
      (codePoint >= 0x0300 && codePoint <= 0x036f) ||
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    )
      continue;
    width +=
      codePoint >= 0x1100 &&
      (codePoint <= 0x115f ||
        codePoint === 0x2329 ||
        codePoint === 0x232a ||
        (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
        (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
        (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
        (codePoint >= 0xff00 && codePoint <= 0xff60) ||
        (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
        (codePoint >= 0x1f300 && codePoint <= 0x1faff))
        ? 2
        : 1;
  }
  return width;
}

function padTableCell(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - tableWidth(value)))}`;
}

function capitalize(value: string): string {
  return value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

function adapterResultRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.map(value =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : { value },
    );
  }
  if (result && typeof result === 'object') return [result as Record<string, unknown>];
  return [{ value: result }];
}

function formatAdapterTable(
  result: unknown,
  outputFields: string[],
  locale: SupportedLocale,
  elapsedSeconds: number,
): string {
  const rows = adapterResultRows(result);
  if (rows.length === 0) return localized(locale, '(no data)', '（无数据）');
  const columns = outputFields.length ? outputFields : Object.keys(rows[0] ?? {});
  if (columns.length === 0) return localized(locale, '(no data)', '（无数据）');
  const headers = columns.map(capitalize);
  const values = rows.map(resultRow => columns.map(column => tableCell(resultRow[column])));
  const widths = columns.map((_, columnIndex) =>
    Math.max(
      tableWidth(headers[columnIndex] ?? ''),
      ...values.map(resultRow => tableWidth(resultRow[columnIndex] ?? '')),
    ),
  );
  const border = (left: string, middle: string, right: string, fill: string): string =>
    `${left}${widths.map(width => fill.repeat(width + 2)).join(middle)}${right}`;
  const renderRow = (cells: string[]): string =>
    `│ ${cells.map((cell, index) => padTableCell(cell, widths[index] ?? 0)).join(' │ ')} │`;
  return [
    '',
    border('┌', '┬', '┐', '─'),
    renderRow(headers),
    border('├', '┼', '┤', '─'),
    ...values.map(renderRow),
    border('└', '┴', '┘', '─'),
    `${rows.length} items · ${elapsedSeconds.toFixed(1)}s`,
  ].join('\n');
}

function parseArgumentValue(
  locale: SupportedLocale,
  definition: FetchAdapterArgument,
  value: string,
): string | number | boolean {
  if (definition.type === 'string') return value;
  if (definition.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number))
      throw new Error(
        localized(locale, `${definition.name} must be a number`, `${definition.name} 必须是数字`),
      );
    return number;
  }
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(
    localized(
      locale,
      `${definition.name} must be true or false`,
      `${definition.name} 必须是 true 或 false`,
    ),
  );
}

function parseAdapterArguments(
  locale: SupportedLocale,
  command: FetchAdapterCommand,
  argv: string[],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const definitions = new Map(command.args.map(argument => [argument.name, argument]));
  const positional = command.args.filter(argument => argument.positional);
  let positionalIndex = 0;
  for (let index = 0; index < argv.length;) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) {
      const definition = positional[positionalIndex++];
      if (!definition)
        throw new Error(
          localized(locale, `Unexpected argument: ${argument}`, `意外参数：${argument}`),
        );
      result[definition.name] = parseArgumentValue(locale, definition, argument);
      index += 1;
      continue;
    }
    const negated = argument.startsWith('--no-');
    const separator = argument.indexOf('=');
    const rawOption = separator < 0 ? argument : argument.slice(0, separator);
    const name = negated ? rawOption.slice('--no-'.length) : rawOption.slice(2);
    const definition = definitions.get(name);
    if (!definition || definition.positional)
      throw new Error(
        localized(locale, `Unknown adapter option: ${rawOption}`, `未知适配器选项：${rawOption}`),
      );
    if (definition.type === 'boolean' && separator < 0) {
      result[name] = !negated;
      index += 1;
      continue;
    }
    const parsed = optionValue(argv, index);
    if (negated || parsed.value === undefined)
      throw new Error(
        localized(locale, `${rawOption} requires a value`, `${rawOption} 后需要指定值`),
      );
    result[name] = parseArgumentValue(locale, definition, parsed.value);
    index += parsed.consumed;
  }
  for (const definition of command.args) {
    if (result[definition.name] !== undefined) continue;
    if (definition.default !== undefined) result[definition.name] = definition.default;
    else if (definition.required)
      throw new Error(
        localized(
          locale,
          `Missing required argument: ${definition.name}`,
          `缺少必填参数：${definition.name}`,
        ),
      );
  }
  return result;
}

async function selectBrowser(
  selector: string | undefined,
  options: FetchCommandOptions,
): Promise<BrowserSelection> {
  return await (
    options.dependencies?.selectBrowserFetchRegistration ?? selectBrowserFetchRegistration
  )({ environment: selectionEnvironment(options.environment, selector) });
}

function registryOptions(options: FetchCommandOptions): FetchAdapterRegistryOptions {
  return { environment: options.environment };
}

async function executeAdapter(
  registration: FetchAdapterRegistration,
  command: FetchAdapterCommand,
  args: Record<string, string | number | boolean>,
  browserSelector: string | undefined,
  options: FetchCommandOptions,
): Promise<unknown> {
  const selection = await selectBrowser(browserSelector, options);
  const clientOptions: BrowserFetchClientOptions = {};
  const active = await (
    options.dependencies?.createBrowserFetchSession ?? createBrowserFetchSession
  )(selection.state, clientOptions);
  try {
    return await (options.dependencies?.dispatchFetchAdapter ?? dispatchFetchAdapter)(
      registration,
      active,
      command.name,
      args,
      { environment: options.environment },
    );
  } finally {
    await (options.dependencies?.releaseBrowserFetchSession ?? releaseBrowserFetchSession)(
      active,
      clientOptions,
    ).catch(() => undefined);
  }
}

export async function runFetchCommand(
  argv: string[],
  options: FetchCommandOptions,
): Promise<number> {
  const readRegistry = options.dependencies?.readFetchAdapterRegistry ?? readFetchAdapterRegistry;
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(fetchHelp(options.locale, await readRegistry(registryOptions(options))));
    return 0;
  }

  if (absoluteHttpUrl(argv[0])) {
    if (argv.includes('--help') || argv.includes('-h')) {
      console.log(fetchHelp(options.locale, await readRegistry(registryOptions(options))));
      return 0;
    }
    const parsed = parseRawFetchArguments(argv, options.locale);
    const selection = await selectBrowser(parsed.browserSelector, options);
    const result = await (options.dependencies?.runBrowserFetch ?? runBrowserFetch)(
      selection.state,
      parsed.request,
    );
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  const adapterId = argv[0]!;
  const registry = await readRegistry(registryOptions(options));
  const metadata = registry.adapters.find(adapter => adapter.manifest.id === adapterId);
  if (!metadata) {
    throw new Error(
      localized(
        options.locale,
        `Unknown fetch target: ${adapterId}. Use an absolute URL or an installed site adapter.`,
        `未知 Fetch 目标：${adapterId}。请使用绝对 URL 或已安装的站点适配器。`,
      ),
    );
  }
  if (argv.length === 1 || argv[1] === '--help' || argv[1] === '-h') {
    console.log(siteHelp(options.locale, metadata.manifest));
    return 0;
  }
  const commandName = argv[1]!;
  const command = metadata.manifest.commands.find(candidate => candidate.name === commandName);
  if (!command)
    throw new Error(
      localized(
        options.locale,
        `Unknown ${adapterId} command: ${commandName}`,
        `未知 ${adapterId} 命令：${commandName}`,
      ),
    );
  if (argv.slice(2).includes('--help') || argv.slice(2).includes('-h')) {
    console.log(commandHelp(options.locale, metadata.manifest, command));
    return 0;
  }
  const now = options.dependencies?.now ?? Date.now;
  const startedAt = now();
  const selectedArguments = extractAdapterInvocationOptions(argv.slice(2), options.locale);
  const args = parseAdapterArguments(options.locale, command, selectedArguments.argv);
  const registration = await (
    options.dependencies?.readFetchAdapterRegistration ?? readFetchAdapterRegistration
  )(adapterId, registryOptions(options));
  if (!registration)
    throw new Error(
      localized(
        options.locale,
        `Fetch adapter is not installed: ${adapterId}`,
        `Fetch 适配器未安装：${adapterId}`,
      ),
    );
  const result = await executeAdapter(
    registration,
    command,
    args,
    selectedArguments.browserSelector,
    options,
  );
  console.log(
    selectedArguments.json
      ? JSON.stringify(result, null, 2)
      : formatAdapterTable(
          result,
          command.output,
          options.locale,
          Math.max(0, now() - startedAt) / 1000,
        ),
  );
  return 0;
}
