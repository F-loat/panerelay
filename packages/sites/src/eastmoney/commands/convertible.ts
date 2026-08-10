import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, clistUrl, EastmoneyClient, objectRows, pick } from '../client.js';
const SORTS = {
  change: ['f3', '1'],
  drop: ['f3', '0'],
  turnover: ['f6', '1'],
  price: ['f2', '1'],
  premium: ['f237', '1'],
  value: ['f236', '1'],
  'put-trigger': ['f239', '1'],
} as const;
export default defineCommand({
  name: 'convertible',
  description: 'List Eastmoney convertible bonds.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'turnover' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'bondCode',
    'bondName',
    'bondPrice',
    'bondChangePct',
    'stockCode',
    'stockName',
    'stockPrice',
    'stockChangePct',
    'convPrice',
    'convValue',
    'convPremiumPct',
    'pureBondPremiumPct',
    'putTriggerPrice',
    'listDate',
  ],
  examples: ['panerelay eastmoney convertible --limit 10'],
  async run(context, args) {
    const sort = choice(args.sort, 'turnover', SORTS, 'sort');
    const take = bounded(args.limit, 20);
    const [fid, po] = SORTS[sort as keyof typeof SORTS];
    return objectRows(
      pick(
        pick(
          await new EastmoneyClient(context).json(
            clistUrl({
              pz: String(take),
              po,
              fid,
              fs: 'b:MK0354',
              fields: 'f12,f14,f2,f3,f6,f229,f230,f232,f234,f235,f236,f237,f238,f239,f243',
            }),
          ),
          'data',
        ),
        'diff',
      ),
      'convertible',
    )
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        bondCode: pick(item, 'f12'),
        bondName: pick(item, 'f14'),
        bondPrice: pick(item, 'f2'),
        bondChangePct: pick(item, 'f3'),
        stockCode: pick(item, 'f232'),
        stockName: pick(item, 'f234'),
        stockPrice: pick(item, 'f229'),
        stockChangePct: pick(item, 'f230'),
        convPrice: pick(item, 'f235'),
        convValue: pick(item, 'f236'),
        convPremiumPct: pick(item, 'f237'),
        pureBondPremiumPct: pick(item, 'f238'),
        putTriggerPrice: pick(item, 'f239'),
        listDate: pick(item, 'f243'),
      }));
  },
});
