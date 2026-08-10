import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, clistUrl, EastmoneyClient, objectRows, pick } from '../client.js';
const TYPES = { industry: 'm:90+t:2', concept: 'm:90+t:3', region: 'm:90+t:1' };
const SORTS = {
  change: ['f3', '1'],
  drop: ['f3', '0'],
  'money-flow': ['f62', '1'],
  'out-flow': ['f62', '0'],
  turnover: ['f6', '1'],
} as const;
export default defineCommand({
  name: 'sectors',
  description: 'List Eastmoney industry, concept, or region sectors.',
  access: 'read',
  args: [
    { name: 'type', description: 'Sector type.', type: 'string', default: 'industry' },
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'change' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'code',
    'name',
    'price',
    'changePercent',
    'mainNet',
    'leadStock',
    'leadChangePercent',
    'upCount',
    'downCount',
  ],
  examples: ['panerelay eastmoney sectors --limit 10'],
  async run(context, args) {
    const type = choice(args.type, 'industry', TYPES, 'type');
    const sort = choice(args.sort, 'change', SORTS, 'sort');
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
              fs: TYPES[type as keyof typeof TYPES],
              fields: 'f12,f14,f2,f3,f62,f104,f105,f128,f136,f140,f141',
            }),
          ),
          'data',
        ),
        'diff',
      ),
      'sectors',
    )
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        code: pick(item, 'f12'),
        name: pick(item, 'f14'),
        price: pick(item, 'f2'),
        changePercent: pick(item, 'f3'),
        mainNet: pick(item, 'f62'),
        leadStock: pick(item, 'f128'),
        leadChangePercent: pick(item, 'f136'),
        upCount: pick(item, 'f104'),
        downCount: pick(item, 'f105'),
      }));
  },
});
