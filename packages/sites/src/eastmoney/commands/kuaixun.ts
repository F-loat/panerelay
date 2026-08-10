import { defineCommand } from '@panerelay/site-kit';
import { bounded, EastmoneyClient, objectRows, pick, text } from '../client.js';
export default defineCommand({
  name: 'kuaixun',
  description: 'List Eastmoney 7x24 fast news.',
  access: 'read',
  args: [
    { name: 'column', description: 'Fast-news column.', type: 'string', default: '102' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['time', 'title', 'summary', 'stocks'],
  examples: ['panerelay eastmoney kuaixun --limit 10'],
  async run(context, args) {
    const take = bounded(args.limit, 20);
    const url = new URL('https://np-listapi.eastmoney.com/comm/web/getFastNewsList');
    for (const [key, value] of Object.entries({
      client: 'web',
      biz: 'web_724',
      fastColumn: text(args.column || '102'),
      sortEnd: '',
      pageSize: String(take),
      req_trace: '1',
    }))
      url.searchParams.set(key, value);
    return objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'data'), 'fastNewsList'),
      'kuaixun',
    )
      .slice(0, take)
      .map(item => ({
        time: pick(item, 'showTime'),
        title: pick(item, 'title'),
        summary: text(pick(item, 'summary')).replace(/\s+/g, ' ').slice(0, 400),
        stocks: Array.isArray(pick(item, 'stockList'))
          ? (pick(item, 'stockList') as unknown[]).join(', ')
          : '',
      }));
  },
});
