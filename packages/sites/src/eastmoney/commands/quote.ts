import { defineCommand } from '@panerelay/site-kit';
import { EastmoneyClient, objectRows, pick, secid, symbols } from '../client.js';
const FIELDS = 'f12,f13,f14,f2,f3,f4,f5,f6,f7,f8,f9,f10,f15,f16,f17,f18,f20,f21,f23';
export default defineCommand({
  name: 'quote',
  description: 'Read Eastmoney A-share, Hong Kong, or US quotes.',
  access: 'read',
  args: [
    {
      name: 'symbols',
      description: 'Comma or space separated symbols.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'code',
    'name',
    'market',
    'price',
    'changePercent',
    'change',
    'open',
    'high',
    'low',
    'prevClose',
    'volume',
    'turnover',
    'turnoverRate',
    'amplitude',
    'peDynamic',
    'priceBook',
    'marketCap',
    'floatMarketCap',
  ],
  examples: ['panerelay eastmoney quote 600519'],
  async run(context, args) {
    const url = new URL('https://push2.eastmoney.com/api/qt/ulist.np/get');
    url.searchParams.set('secids', symbols(args.symbols).map(secid).join(','));
    url.searchParams.set('fltt', '2');
    url.searchParams.set('fields', FIELDS);
    url.searchParams.set('ut', 'bd1d9ddb04089700cf9c27f6f7426281');
    return objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'data'), 'diff'),
      'quote',
    ).map(item => ({
      code: pick(item, 'f12'),
      name: pick(item, 'f14'),
      market:
        Number(pick(item, 'f13')) === 1
          ? 'SH'
          : Number(pick(item, 'f13')) === 116
            ? 'HK'
            : [105, 106, 107].includes(Number(pick(item, 'f13')))
              ? 'US'
              : 'SZ/BJ',
      price: pick(item, 'f2'),
      changePercent: pick(item, 'f3'),
      change: pick(item, 'f4'),
      open: pick(item, 'f17'),
      high: pick(item, 'f15'),
      low: pick(item, 'f16'),
      prevClose: pick(item, 'f18'),
      volume: pick(item, 'f5'),
      turnover: pick(item, 'f6'),
      turnoverRate: pick(item, 'f8'),
      amplitude: pick(item, 'f7'),
      peDynamic: pick(item, 'f9'),
      priceBook: pick(item, 'f23'),
      marketCap: pick(item, 'f20'),
      floatMarketCap: pick(item, 'f21'),
    }));
  },
});
