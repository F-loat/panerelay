import { defineCommand, type BrowserFetchRequest } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
const obj = (v: unknown): Value =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Value) : {};
const pick = (v: unknown, k: string): unknown => obj(v)[k];

export default defineCommand({
  name: 'quote',
  description: 'Get a Yahoo Finance stock quote.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock ticker.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'symbol',
    'name',
    'price',
    'change',
    'changePercent',
    'open',
    'high',
    'low',
    'volume',
    'marketCap',
  ],
  examples: ['panerelay yahoo-finance quote AAPL'],
  async run(context, args) {
    const symbol = String(args.symbol ?? '')
      .trim()
      .toUpperCase();
    if (!symbol) throw new Error('yahoo-finance symbol is required');
    const request: BrowserFetchRequest = {
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: true,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`yahoo-finance quote failed: HTTP ${response.status}`);
    const results = pick(pick(response.body, 'chart'), 'result');
    const chart = Array.isArray(results) ? obj(results[0]) : {};
    const meta = obj(pick(chart, 'meta'));
    const indicators = pick(pick(pick(chart, 'indicators'), 'quote'), '0');
    const quotes = pick(pick(chart, 'indicators'), 'quote');
    const quote = Array.isArray(quotes) ? obj(quotes[0]) : obj(indicators);
    const price = Number(pick(meta, 'regularMarketPrice'));
    const previous = Number(pick(meta, 'previousClose') ?? pick(meta, 'chartPreviousClose'));
    const change = Number.isFinite(price) && Number.isFinite(previous) ? price - previous : null;
    return [
      {
        symbol: pick(meta, 'symbol') ?? symbol,
        name: pick(meta, 'shortName') ?? pick(meta, 'longName') ?? symbol,
        price: Number.isFinite(price) ? Number(price.toFixed(2)) : null,
        change: change == null ? null : change.toFixed(2),
        changePercent:
          change == null || !previous ? null : `${((change / previous) * 100).toFixed(2)}%`,
        open: Array.isArray(pick(quote, 'open'))
          ? ((pick(quote, 'open') as unknown[])[0] ?? null)
          : null,
        high: pick(meta, 'regularMarketDayHigh') ?? null,
        low: pick(meta, 'regularMarketDayLow') ?? null,
        volume: pick(meta, 'regularMarketVolume') ?? null,
        marketCap: null,
      },
    ];
  },
});
