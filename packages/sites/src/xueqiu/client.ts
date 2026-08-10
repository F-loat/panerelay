import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;

export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}

export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`xueqiu ${name} is required`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`xueqiu value must be an integer between 1 and ${maximum}`);
  return result;
}

export function rows(value: unknown, label: string): Value[] {
  if (!Array.isArray(value)) throw new Error(`xueqiu ${label} response is malformed`);
  return value.map(object);
}

export function stripHtml(value: unknown): string {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function percent(value: unknown): string | null {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : null;
}

export function amount(value: unknown): string | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (Math.abs(number) >= 1e12) return `${(number / 1e12).toFixed(2)}万亿`;
  if (Math.abs(number) >= 1e8) return `${(number / 1e8).toFixed(2)}亿`;
  if (Math.abs(number) >= 1e4) return `${(number / 1e4).toFixed(2)}万`;
  return String(number);
}

export function chinaDate(value: unknown): string | null {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(timestamp))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function symbol(value: unknown): string {
  const result = required(value, 'symbol').toUpperCase();
  if (/^HTTPS?:\/\//.test(result)) throw new Error('xueqiu symbol cannot be a URL');
  if (!/^(?:[A-Z]{2}\d{5,6}|\d{4,6}|[A-Z]{1,5}(?:[.-][A-Z]{1,2})?)$/.test(result))
    throw new Error(`xueqiu symbol is invalid: ${result}`);
  return result;
}

export class XueqiuClient {
  readonly #context: SiteCommandContext;
  readonly #seededReferers = new Set<string>();

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async #seed(referer: string): Promise<void> {
    if (this.#seededReferers.has(referer)) return;
    const response = await this.#context.fetch({
      url: referer,
      headers: { accept: 'text/html,application/xhtml+xml' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 400 || response.bodyType !== 'text')
      throw new Error(`xueqiu session page failed: HTTP ${response.status}`);
    this.#seededReferers.add(referer);
  }

  async get(url: string, referer = 'https://xueqiu.com/'): Promise<Value> {
    await this.#seed(referer);
    const request: BrowserFetchRequest = {
      url,
      headers: {
        accept: 'application/json, text/plain, */*',
        referer,
        'x-requested-with': 'XMLHttpRequest',
      },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('xueqiu requires a valid logged-in or challenge-cleared browser session');
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`xueqiu request failed: HTTP ${response.status}`);
    const payload = response.body as Value;
    const errorCode = pick(payload, 'error_code');
    if (errorCode)
      throw new Error(
        `xueqiu API ${text(errorCode)}: ${text(pick(payload, 'error_description')) || 'request failed'}`,
      );
    return payload;
  }
}

export type DanjuanSnapshot = {
  asOf: unknown;
  totalAssetAmount: unknown;
  totalAssetDailyGain: unknown;
  totalFundMarketValue: unknown;
  accounts: Value[];
  holdings: Value[];
};

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function danjuanSnapshot(client: XueqiuClient): Promise<DanjuanSnapshot> {
  const gain = await client.get(
    'https://danjuanfunds.com/djapi/fundx/profit/assets/gain?gains=%5B%22private%22%5D',
    'https://danjuanfunds.com/my-money',
  );
  const root = object(pick(gain, 'data'));
  const sections = rows(pick(root, 'items'), 'Danjuan assets');
  const fund = sections.find(item => pick(item, 'summary_type') === 'FUND') ?? {};
  const accounts = rows(pick(fund, 'invest_account_list'), 'Danjuan accounts').map(account => ({
    accountId: text(pick(account, 'invest_account_id')),
    accountName: text(pick(account, 'invest_account_name')),
    accountType: text(pick(account, 'invest_account_type')),
    accountCode: text(pick(account, 'invest_account_code')),
    marketValue: finite(pick(account, 'market_value')),
    dailyGain: finite(pick(account, 'daily_gain')),
    mainFlag: Boolean(pick(account, 'main_flag')),
  }));
  if (!accounts.length)
    throw new Error('xueqiu found no Danjuan fund accounts; login may be required');
  const details = await Promise.all(
    accounts.map(account =>
      client.get(
        `https://danjuanfunds.com/djapi/fundx/profit/assets/summary?invest_account_id=${encodeURIComponent(text(pick(account, 'accountId')))}`,
        'https://danjuanfunds.com/my-money',
      ),
    ),
  );
  const holdings: Value[] = [];
  details.forEach((detail, index) => {
    const data = object(pick(detail, 'data'));
    const account = accounts[index] ?? {};
    for (const fundItem of rows(pick(data, 'items'), 'Danjuan holdings')) {
      holdings.push({
        accountId: text(pick(account, 'accountId')),
        accountName: text(pick(data, 'invest_account_name')) || text(pick(account, 'accountName')),
        accountType: text(pick(data, 'invest_account_type')) || text(pick(account, 'accountType')),
        fdCode: text(pick(fundItem, 'fd_code')),
        fdName: text(pick(fundItem, 'fd_name')),
        marketValue: finite(pick(fundItem, 'market_value')),
        volume: finite(pick(fundItem, 'volume')),
        dailyGain: finite(pick(fundItem, 'daily_gain')),
        holdGain: finite(pick(fundItem, 'hold_gain')),
        holdGainRate: finite(pick(fundItem, 'hold_gain_rate')),
        marketPercent: finite(pick(fundItem, 'market_percent')),
      });
    }
  });
  return {
    asOf: pick(root, 'daily_gain_date') ?? null,
    totalAssetAmount: finite(pick(root, 'amount')),
    totalAssetDailyGain: finite(pick(root, 'daily_gain')),
    totalFundMarketValue: finite(pick(fund, 'amount')),
    accounts,
    holdings,
  };
}
