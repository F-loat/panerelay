import { defineCommand } from '@panerelay/site-kit';
import {
  DongchediClient,
  limit,
  numericId,
  object,
  pageUrl,
  pick,
  requiredText,
  text,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Dongchedi car series by keyword.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Car-series keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum matching series.', type: 'number', default: 15 },
  ],
  output: ['rank', 'seriesId', 'name', 'brand', 'officialPrice', 'dealerPrice', 'pictures', 'url'],
  examples: ['panerelay dongchedi search 宝马X5 --limit 10'],
  async run(context, args) {
    const keyword = requiredText(args.keyword, 'keyword');
    const take = limit(args.limit, 15, 30);
    const props = await new DongchediClient(context).pageProps(
      `/search?keyword=${encodeURIComponent(keyword)}`,
    );
    const data = pick(object(pick(props, 'searchData')), 'data');
    if (!Array.isArray(data)) throw new Error('dongchedi search returned an unexpected payload');
    const rows = data
      .filter(item => Number(pick(item, 'cell_type')) === 26)
      .slice(0, take)
      .map((item, index) => {
        const series = object(item);
        const display = object(pick(series, 'display'));
        const id = numericId(pick(series, 'series_id'), `search row ${index + 1}`);
        return {
          rank: index + 1,
          seriesId: id,
          name: requiredText(pick(display, 'series_name') ?? pick(display, 'title'), 'series name'),
          brand: text(pick(display, 'sub_brand_name')) || null,
          officialPrice: text(pick(display, 'official_price')) || null,
          dealerPrice: text(pick(display, 'agent_price')) || null,
          pictures: Number(pick(display, 'picture_num')) || null,
          url: pageUrl(`/auto/series/${id}`),
        };
      });
    if (!rows.length) throw new Error(`dongchedi returned no car series for "${keyword}"`);
    return rows;
  },
});
