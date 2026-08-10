import { defineCommand } from '@panerelay/site-kit';
import { BarchartClient, fixed, limit, pick, symbol, text } from '../client.js';

export default defineCommand({
  name: 'options',
  description: 'Get a Barchart options chain with greeks.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock ticker.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'type', description: 'Call or Put.', type: 'string', default: 'Call' },
    { name: 'limit', description: 'Maximum strikes.', type: 'number', default: 20 },
  ],
  output: [
    'strike',
    'bid',
    'ask',
    'last',
    'change',
    'volume',
    'openInterest',
    'iv',
    'delta',
    'gamma',
    'theta',
    'vega',
    'expiration',
  ],
  examples: ['panerelay barchart options AAPL --type Call --limit 20'],
  async run(context, args) {
    const ticker = symbol(args.symbol);
    const type = text(args.type) || 'Call';
    if (!/^(call|put)$/i.test(type)) throw new Error('barchart type must be Call or Put');
    const take = limit(args.limit, 20);
    const client = new BarchartClient(context);
    await client.seed(`/stocks/quotes/${encodeURIComponent(ticker)}/options`);
    const fields =
      'strikePrice,bidPrice,askPrice,lastPrice,priceChange,volume,openInterest,volatility,delta,gamma,theta,vega,expirationDate,optionType,percentFromLast';
    const rows = await client.api(
      `/proxies/core-api/v1/options/chain?symbol=${encodeURIComponent(ticker)}&fields=${fields}&raw=1`,
    );
    return rows
      .filter(row => text(pick(row, 'optionType')).toLowerCase() === type.toLowerCase())
      .sort(
        (a, b) =>
          Math.abs(Number(pick(a, 'percentFromLast') ?? 999)) -
          Math.abs(Number(pick(b, 'percentFromLast') ?? 999)),
      )
      .slice(0, take)
      .map(row => ({
        strike: pick(row, 'strikePrice'),
        bid: fixed(pick(row, 'bidPrice'), 2),
        ask: fixed(pick(row, 'askPrice'), 2),
        last: fixed(pick(row, 'lastPrice'), 2),
        change: fixed(pick(row, 'priceChange'), 2),
        volume: pick(row, 'volume'),
        openInterest: pick(row, 'openInterest'),
        iv: fixed(pick(row, 'volatility'), 2, '%'),
        delta: fixed(pick(row, 'delta'), 4),
        gamma: fixed(pick(row, 'gamma'), 4),
        theta: fixed(pick(row, 'theta'), 4),
        vega: fixed(pick(row, 'vega'), 4),
        expiration: pick(row, 'expirationDate') ?? null,
      }));
  },
});
