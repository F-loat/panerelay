import {
  SiteError,
  defineCommand,
  responseText,
  type BrowserFetchResponse,
} from '@panerelay/site-kit';

const MARKET_CN = '11';
const MARKET_HK = '31';
const MARKET_US = '41';

const MARKETS = {
  auto: [MARKET_CN, MARKET_HK, MARKET_US],
  cn: [MARKET_CN],
  hk: [MARKET_HK],
  us: [MARKET_US],
} as const;

interface Suggestion {
  market: string;
  name: string;
  symbol: string;
}

function assertSuccessful(response: BrowserFetchResponse): void {
  if (response.status === 429) {
    throw new SiteError('upstream-failure', 'Sina Finance is rate limiting requests', true);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new SiteError(
      'upstream-failure',
      `Sina Finance request failed with HTTP ${response.status}`,
    );
  }
}

function parseSuggestions(raw: string, markets: readonly string[]): Suggestion[] {
  const match = /suggestvalue="([^"]*)"/s.exec(raw);
  if (!match) {
    throw new SiteError('shape-drift', 'Sina Finance suggestion response has changed');
  }
  return (match[1] ?? '')
    .split(';')
    .filter(Boolean)
    .map(value => {
      const fields = value.split(',');
      return {
        name: fields[4] || fields[0] || '',
        market: fields[1] || '',
        symbol: fields[3] || '',
      };
    })
    .filter(value => value.name && value.symbol && markets.includes(value.market));
}

function quoteSymbol(value: Suggestion): string {
  if (value.market === MARKET_HK) return `hk${value.symbol}`;
  if (value.market === MARKET_US) return `gb_${value.symbol}`;
  return value.symbol;
}

function parseQuote(raw: string, symbol: string): string[] {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`hq_str_${escaped}="([^"]*)"`).exec(raw);
  if (!match) {
    throw new SiteError('shape-drift', 'Sina Finance quote response has changed');
  }
  return (match[1] ?? '').split(',');
}

function formatMarketCap(value: string): string {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T`;
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  return String(amount);
}

function scoreSuggestion(value: Suggestion, needle: string): number {
  const name = value.name.toLowerCase();
  const symbol = value.symbol.toLowerCase();
  if (name === needle || symbol === needle) return 1;
  if (symbol.includes(needle)) return needle.length / symbol.length;
  if (name.includes(needle)) return needle.length / name.length;
  return 0;
}

export default defineCommand({
  name: 'stock',
  description: 'Get a Sina Finance quote for a mainland China, Hong Kong, or US stock.',
  access: 'read',
  args: [
    {
      name: 'key',
      description: 'Stock name or code, such as 贵州茅台, 腾讯控股, or AAPL.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'market',
      description: 'Market to search: cn, hk, us, or auto.',
      type: 'string',
      default: 'auto',
    },
  ],
  output: [
    'Symbol',
    'Name',
    'Price',
    'Change',
    'ChangePercent',
    'Open',
    'High',
    'Low',
    'Volume',
    'MarketCap',
  ],
  examples: ['panerelay sinafinance stock AAPL --market us'],
  async run(context, args) {
    const key = String(args.key ?? '').trim();
    const market = String(args.market ?? 'auto').toLowerCase();
    if (!key) throw new SiteError('invalid-input', 'Stock name or code is required');
    if (!(market in MARKETS)) {
      throw new SiteError('invalid-input', 'Market must be cn, hk, us, or auto');
    }
    const targetMarkets: readonly string[] = MARKETS[market as keyof typeof MARKETS];
    const suggestResponse = await context.fetch({
      url: `https://suggest3.sinajs.cn/suggest/type=${targetMarkets.join(',')}&key=${encodeURIComponent(key)}`,
      headers: { referer: 'https://finance.sina.com.cn/' },
      responseType: 'base64',
      withCookies: false,
    });
    assertSuccessful(suggestResponse);
    const suggestions = parseSuggestions(responseText(suggestResponse, 'gbk'), targetMarkets);
    if (suggestions.length === 0) {
      throw new SiteError('empty-result', `No stock was found for ${key}`);
    }

    const needle = key.toLowerCase();
    const best = suggestions.sort((left, right) => {
      const scoreDifference = scoreSuggestion(right, needle) - scoreSuggestion(left, needle);
      return scoreDifference !== 0
        ? scoreDifference
        : targetMarkets.indexOf(left.market) - targetMarkets.indexOf(right.market);
    })[0];
    if (!best) throw new SiteError('empty-result', `No stock was found for ${key}`);

    const symbol = quoteSymbol(best);
    const quoteResponse = await context.fetch({
      url: `https://hq.sinajs.cn/list=${symbol}`,
      headers: { referer: 'https://finance.sina.com.cn/' },
      responseType: 'base64',
      withCookies: false,
    });
    assertSuccessful(quoteResponse);
    const fields = parseQuote(responseText(quoteResponse, 'gbk'), symbol);
    if (fields.length < 2 || !fields[0]) {
      throw new SiteError('empty-result', `No quote is available for ${key}`);
    }

    if (best.market === MARKET_CN) {
      if (fields.length < 9) {
        throw new SiteError('shape-drift', 'Sina Finance mainland quote is incomplete');
      }
      const price = Number.parseFloat(fields[3] ?? '');
      const previous = Number.parseFloat(fields[2] ?? '');
      if (!Number.isFinite(price) || !Number.isFinite(previous) || previous === 0) {
        throw new SiteError('shape-drift', 'Sina Finance mainland quote has invalid prices');
      }
      return [
        {
          Symbol: symbol.toUpperCase(),
          Name: fields[0],
          Price: fields[3],
          Change: (price - previous).toFixed(2),
          ChangePercent: `${(((price - previous) / previous) * 100).toFixed(2)}%`,
          Open: fields[1],
          High: fields[4],
          Low: fields[5],
          Volume: fields[8],
          MarketCap: '',
        },
      ];
    }

    if (best.market === MARKET_HK) {
      if (fields.length < 12) {
        throw new SiteError('shape-drift', 'Sina Finance Hong Kong quote is incomplete');
      }
      return [
        {
          Symbol: best.symbol,
          Name: fields[1],
          Price: fields[2],
          Change: fields[7],
          ChangePercent: `${fields[8]}%`,
          Open: fields[6],
          High: fields[4],
          Low: fields[5],
          Volume: fields[11],
          MarketCap: '',
        },
      ];
    }

    if (fields.length < 13) {
      throw new SiteError('shape-drift', 'Sina Finance US quote is incomplete');
    }
    return [
      {
        Symbol: best.symbol.toUpperCase(),
        Name: fields[0],
        Price: fields[1],
        Change: fields[4],
        ChangePercent: `${fields[2]}%`,
        Open: fields[6],
        High: fields[8],
        Low: fields[9],
        Volume: fields[10],
        MarketCap: formatMarketCap(fields[12] ?? ''),
      },
    ];
  },
});
