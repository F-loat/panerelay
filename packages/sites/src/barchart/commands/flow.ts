import { defineCommand } from '@panerelay/site-kit';
import { BarchartClient, fixed, limit, pick, text } from '../client.js';

export default defineCommand({
  name: 'flow',
  description: 'List unusual Barchart options activity.',
  access: 'read',
  args: [
    { name: 'type', description: 'all, call, or put.', type: 'string', default: 'all' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'symbol',
    'type',
    'strike',
    'expiration',
    'last',
    'volume',
    'openInterest',
    'volOiRatio',
    'iv',
  ],
  examples: ['panerelay barchart flow --type call --limit 20'],
  async run(context, args) {
    const type = (text(args.type) || 'all').toLowerCase();
    if (!['all', 'call', 'put'].includes(type))
      throw new Error('barchart type must be all, call, or put');
    const take = limit(args.limit, 20);
    const client = new BarchartClient(context);
    await client.seed('/options/unusual-activity/stocks');
    const fields =
      'baseSymbol,strikePrice,expirationDate,optionType,lastPrice,volume,openInterest,volumeOpenInterestRatio,volatility';
    const fetchLimit = type === 'all' ? take : take * 3;
    let rows = await client.api(
      `/proxies/core-api/v1/options/get?list=options.unusual_activity.stocks.us&fields=${fields}&orderBy=volumeOpenInterestRatio&orderDir=desc&raw=1&limit=${fetchLimit}`,
    );
    if (!rows.length)
      rows = await client.api(
        `/proxies/core-api/v1/options/get?list=options.mostActive.us&fields=${fields}&orderBy=volumeOpenInterestRatio&orderDir=desc&raw=1&limit=${fetchLimit}`,
      );
    return rows
      .filter(row => type === 'all' || text(pick(row, 'optionType')).toLowerCase() === type)
      .slice(0, take)
      .map(row => ({
        symbol: text(pick(row, 'baseSymbol') ?? pick(row, 'symbol')),
        type: text(pick(row, 'optionType')),
        strike: pick(row, 'strikePrice'),
        expiration: pick(row, 'expirationDate') ?? null,
        last: fixed(pick(row, 'lastPrice'), 2),
        volume: pick(row, 'volume'),
        openInterest: pick(row, 'openInterest'),
        volOiRatio: fixed(pick(row, 'volumeOpenInterestRatio'), 2),
        iv: fixed(pick(row, 'volatility'), 2, '%'),
      }));
  },
});
