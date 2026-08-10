import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, PixivClient, required, text, workRow } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Pixiv illustrations.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Keyword or tag.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
    { name: 'order', description: 'Sort order.', type: 'string', default: 'date_d' },
    { name: 'mode', description: 'all, safe, or r18.', type: 'string', default: 'all' },
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
  ],
  output: ['rank', 'title', 'author', 'user_id', 'illust_id', 'pages', 'bookmarks', 'tags', 'url'],
  examples: ['panerelay pixiv search landscape --limit 20'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = bounded(args.limit, 20, 100);
    const order = text(args.order) || 'date_d';
    const mode = text(args.mode) || 'all';
    const page = bounded(args.page, 1, 1_000);
    const body = object(
      await new PixivClient(context).ajax(
        `/ajax/search/illustrations/${encodeURIComponent(query)}`,
        { word: query, order, mode, p: page, s_mode: 's_tag_full', type: 'illust_and_ugoira' },
      ),
    );
    const items = pick(pick(body, 'illust'), 'data');
    if (!Array.isArray(items)) throw new Error('pixiv search response is malformed');
    return items
      .map(object)
      .filter(item => text(pick(item, 'id')))
      .slice(0, limit)
      .map((item, index) => workRow(item, index + 1));
  },
});
