import { defineCommand } from '@panerelay/site-kit';
import { EastmoneyClient, objectRows, pick, text } from '../client.js';
const GROUPS = {
  main: [
    ['1.000001', '上证指数'],
    ['0.399001', '深证成指'],
    ['0.399006', '创业板指'],
    ['1.000688', '科创50'],
    ['1.000300', '沪深300'],
    ['1.000905', '中证500'],
  ],
  hk: [
    ['100.HSI', '恒生指数'],
    ['100.HSCEI', '恒生国企'],
    ['100.HSTECH', '恒生科技'],
  ],
  us: [
    ['100.DJIA', '道琼斯'],
    ['100.SPX', '标普500'],
    ['100.NDX', '纳斯达克100'],
    ['100.IXIC', '纳斯达克综指'],
  ],
} as const;
export default defineCommand({
  name: 'index-board',
  description: 'Read major Eastmoney market indices.',
  access: 'read',
  args: [{ name: 'group', description: 'main, hk, us, or all.', type: 'string', default: 'main' }],
  output: ['code', 'name', 'price', 'changePercent', 'change', 'open', 'high', 'low', 'prevClose'],
  examples: ['panerelay eastmoney index-board --group all'],
  async run(context, args) {
    const group = String(args.group || 'main').toLowerCase();
    if (!['main', 'hk', 'us', 'all'].includes(group))
      throw new Error('eastmoney group must be main, hk, us, or all');
    const entries =
      group === 'all'
        ? [...GROUPS.main, ...GROUPS.hk, ...GROUPS.us]
        : [...GROUPS[group as keyof typeof GROUPS]];
    const url = new URL('https://push2.eastmoney.com/api/qt/ulist.np/get');
    url.searchParams.set('secids', entries.map(([id]) => id).join(','));
    url.searchParams.set('fltt', '2');
    url.searchParams.set('fields', 'f2,f3,f4,f12,f13,f14,f15,f16,f17,f18');
    url.searchParams.set('ut', 'bd1d9ddb04089700cf9c27f6f7426281');
    const rows = objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'data'), 'diff'),
      'index-board',
    );
    return entries
      .map(([id, fallback]) => {
        const code = id.split('.')[1] ?? '';
        const item = rows.find(row => text(pick(row, 'f12')) === code);
        return item
          ? {
              code,
              name: pick(item, 'f14') || fallback,
              price: pick(item, 'f2'),
              changePercent: pick(item, 'f3'),
              change: pick(item, 'f4'),
              open: pick(item, 'f17'),
              high: pick(item, 'f15'),
              low: pick(item, 'f16'),
              prevClose: pick(item, 'f18'),
            }
          : null;
      })
      .filter(Boolean);
  },
});
