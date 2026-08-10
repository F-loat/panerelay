import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, clistUrl, EastmoneyClient, objectRows, pick } from '../client.js';
const SORTS = {
  turnover: ['f6', '1'],
  change: ['f3', '1'],
  drop: ['f3', '0'],
  volume: ['f5', '1'],
  rate: ['f8', '1'],
} as const;
export default defineCommand({
  name: 'etf',
  description: 'List on-exchange Eastmoney ETFs.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'turnover' },
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
  ],
  examples: ['panerelay eastmoney etf --limit 10'],
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
              fs: 'b:MK0021',
              fields: 'f12,f14,f2,f3,f4,f5,f6,f8',
            }),
          ),
          'data',
        ),
        'diff',
      ),
      'etf',
    )
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
      }));
  },
});
