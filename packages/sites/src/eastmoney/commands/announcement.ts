import { defineCommand } from '@panerelay/site-kit';
import { bounded, EastmoneyClient, objectRows, pick, text } from '../client.js';
export default defineCommand({
  name: 'announcement',
  description: 'List Eastmoney listed-company announcements.',
  access: 'read',
  args: [
    {
      name: 'market',
      description: 'Comma-separated exchanges.',
      type: 'string',
      default: 'SHA,SZA,BJA',
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['time', 'code', 'name', 'title', 'category', 'url'],
  examples: ['panerelay eastmoney announcement --limit 10'],
  async run(context, args) {
    const take = bounded(args.limit, 20);
    const url = new URL('https://np-anotice-stock.eastmoney.com/api/security/ann');
    for (const [key, value] of Object.entries({
      page_size: String(take),
      page_index: '1',
      ann_type: text(args.market || 'SHA,SZA,BJA'),
      client_source: 'web',
      f_node: '0',
      s_node: '0',
    }))
      url.searchParams.set(key, value);
    return objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'data'), 'list'),
      'announcement',
    )
      .slice(0, take)
      .map(item => {
        const codes = pick(item, 'codes');
        const primary = Array.isArray(codes) ? codes[0] : {};
        const columns = pick(item, 'columns');
        const category = Array.isArray(columns) ? pick(columns[0], 'column_name') : '';
        const code = text(pick(primary, 'stock_code'));
        return {
          time: text(pick(item, 'notice_date') || pick(item, 'display_time')).slice(0, 19),
          code,
          name: text(pick(primary, 'short_name')),
          title: text(pick(item, 'title') || pick(item, 'title_ch')),
          category,
          url: `https://data.eastmoney.com/notices/detail/${code}/${text(pick(item, 'art_code'))}.html`,
        };
      });
  },
});
