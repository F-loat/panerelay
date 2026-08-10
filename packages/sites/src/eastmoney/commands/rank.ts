import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, clistUrl, EastmoneyClient, objectRows, pick } from '../client.js';
const MARKETS = {
  'hs-a': 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
  'sh-a': 'm:1+t:2,m:1+t:23',
  'sz-a': 'm:0+t:6,m:0+t:80',
  'bj-a': 'm:0+t:81+s:2048',
  cyb: 'm:0+t:80',
  kcb: 'm:1+t:23',
  hk: 'm:116+t:3,m:116+t:4,m:116+t:1,m:116+t:2',
  us: 'm:105,m:106,m:107',
};
const SORTS = {
  change: ['f3', '1'],
  drop: ['f3', '0'],
  turnover: ['f6', '1'],
  volume: ['f5', '1'],
  amplitude: ['f7', '1'],
  rate: ['f8', '1'],
} as const;
export default defineCommand({
  name: 'rank',
  description: 'List Eastmoney market movers.',
  access: 'read',
  args: [
    { name: 'market', description: 'Market segment.', type: 'string', default: 'hs-a' },
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'change' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'code',
    'name',
    'price',
    'changePercent',
    'change',
    'turnover',
    'volume',
    'turnoverRate',
    'peDynamic',
    'marketCap',
  ],
  examples: ['panerelay eastmoney rank --limit 10'],
  async run(context, args) {
    const market = choice(args.market, 'hs-a', MARKETS, 'market');
    const sort = choice(args.sort, 'change', SORTS, 'sort');
    const take = bounded(args.limit, 20);
    const [fid, po] = SORTS[sort as keyof typeof SORTS];
    const body = await new EastmoneyClient(context).json(
      clistUrl({
        pz: String(take),
        po,
        fid,
        fs: MARKETS[market as keyof typeof MARKETS],
        fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23',
      }),
    );
    return objectRows(pick(pick(body, 'data'), 'diff'), 'rank')
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        code: pick(item, 'f12'),
        name: pick(item, 'f14'),
        price: pick(item, 'f2'),
        changePercent: pick(item, 'f3'),
        change: pick(item, 'f4'),
        turnover: pick(item, 'f6'),
        volume: pick(item, 'f5'),
        turnoverRate: pick(item, 'f8'),
        peDynamic: pick(item, 'f9'),
        marketCap: pick(item, 'f20'),
      }));
  },
});
