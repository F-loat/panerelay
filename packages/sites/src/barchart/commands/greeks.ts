import { defineCommand } from '@panerelay/site-kit';
import { BarchartClient, fixed, limit, pick, symbol, text, type Value } from '../client.js';

function nearest(rows: Value[]): Value[] {
  const expirations = rows
    .map(row => text(pick(row, 'expirationDate')))
    .filter(Boolean)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return expirations[0]
    ? rows.filter(row => text(pick(row, 'expirationDate')) === expirations[0])
    : rows;
}

export default defineCommand({
  name: 'greeks',
  description: 'Get near-the-money Barchart option greeks.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock ticker.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'expiration', description: 'Expiration date in YYYY-MM-DD.', type: 'string' },
    { name: 'limit', description: 'Rows per option type.', type: 'number', default: 10 },
  ],
  output: [
    'type',
    'strike',
    'last',
    'iv',
    'delta',
    'gamma',
    'theta',
    'vega',
    'rho',
    'volume',
    'openInterest',
    'expiration',
  ],
  examples: ['panerelay barchart greeks AAPL --limit 10'],
  async run(context, args) {
    const ticker = symbol(args.symbol);
    const expiration = text(args.expiration);
    if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration))
      throw new Error('barchart expiration must use YYYY-MM-DD');
    const take = limit(args.limit, 10);
    const client = new BarchartClient(context);
    await client.seed(`/stocks/quotes/${encodeURIComponent(ticker)}/options`);
    const fields =
      'strikePrice,lastPrice,volume,openInterest,volatility,delta,gamma,theta,vega,rho,expirationDate,optionType,percentFromLast';
    const path = `/proxies/core-api/v1/options/chain?symbol=${encodeURIComponent(ticker)}&fields=${fields}&raw=1${expiration ? `&expirationDate=${expiration}` : ''}`;
    let rows = await client.api(path);
    if (!expiration) rows = nearest(rows);
    const selected = ['call', 'put'].flatMap(type =>
      rows
        .filter(row => text(pick(row, 'optionType')).toLowerCase() === type)
        .sort(
          (a, b) =>
            Math.abs(Number(pick(a, 'percentFromLast') ?? 999)) -
            Math.abs(Number(pick(b, 'percentFromLast') ?? 999)),
        )
        .slice(0, take),
    );
    return selected.map(row => ({
      type: text(pick(row, 'optionType')),
      strike: pick(row, 'strikePrice'),
      last: fixed(pick(row, 'lastPrice'), 2),
      iv: fixed(pick(row, 'volatility'), 2, '%'),
      delta: fixed(pick(row, 'delta'), 4),
      gamma: fixed(pick(row, 'gamma'), 4),
      theta: fixed(pick(row, 'theta'), 4),
      vega: fixed(pick(row, 'vega'), 4),
      rho: fixed(pick(row, 'rho'), 4),
      volume: pick(row, 'volume'),
      openInterest: pick(row, 'openInterest'),
      expiration: text(pick(row, 'expirationDate')),
    }));
  },
});
