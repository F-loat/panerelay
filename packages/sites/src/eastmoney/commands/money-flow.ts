import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, clistUrl, EastmoneyClient, objectRows, pick } from '../client.js';
const RANGES = {
  today: { fid: 'f62', fields: ['f62', 'f184', 'f66', 'f72', 'f78', 'f84'] },
  '5d': { fid: 'f164', fields: ['f164', 'f165', 'f166', 'f169', 'f172', 'f175'] },
  '10d': { fid: 'f174', fields: ['f174', 'f175', 'f176', 'f179', 'f182', 'f185'] },
};
export default defineCommand({
  name: 'money-flow',
  description: 'List Eastmoney main-force capital flows.',
  access: 'read',
  args: [
    { name: 'range', description: 'today, 5d, or 10d.', type: 'string', default: 'today' },
    { name: 'order', description: 'desc or asc.', type: 'string', default: 'desc' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'code',
    'name',
    'price',
    'changePercent',
    'mainNet',
    'mainNetRatio',
    'superNet',
    'bigNet',
    'mediumNet',
    'smallNet',
  ],
  examples: ['panerelay eastmoney money-flow --limit 10'],
  async run(context, args) {
    const range = choice(args.range, 'today', RANGES, 'range');
    const order = String(args.order || 'desc').toLowerCase();
    if (!['asc', 'desc'].includes(order)) throw new Error('eastmoney order must be asc or desc');
    const take = bounded(args.limit, 20);
    const selected = RANGES[range as keyof typeof RANGES];
    const [net, ratio, superNet, big, medium, small] = selected.fields as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const body = await new EastmoneyClient(context).json(
      clistUrl({
        pz: String(take),
        po: order === 'asc' ? '0' : '1',
        fid: selected.fid,
        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
        fields: ['f12', 'f14', 'f2', 'f3', ...selected.fields].join(','),
      }),
    );
    return objectRows(pick(pick(body, 'data'), 'diff'), 'money-flow')
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        code: pick(item, 'f12'),
        name: pick(item, 'f14'),
        price: pick(item, 'f2'),
        changePercent: pick(item, 'f3'),
        mainNet: pick(item, net),
        mainNetRatio: pick(item, ratio),
        superNet: pick(item, superNet),
        bigNet: pick(item, big),
        mediumNet: pick(item, medium),
        smallNet: pick(item, small),
      }));
  },
});
