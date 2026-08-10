import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, PixivClient, text } from '../client.js';

export default defineCommand({
  name: 'ranking',
  description: 'List Pixiv illustration rankings.',
  access: 'read',
  args: [
    { name: 'mode', description: 'Ranking mode.', type: 'string', default: 'daily' },
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'user_id', 'illust_id', 'pages', 'bookmarks', 'url'],
  examples: ['panerelay pixiv ranking --mode daily --page 1 --limit 20'],
  async run(context, args) {
    const mode = text(args.mode) || 'daily';
    if (
      ![
        'daily',
        'weekly',
        'monthly',
        'rookie',
        'original',
        'male',
        'female',
        'daily_r18',
        'weekly_r18',
      ].includes(mode)
    )
      throw new Error('pixiv ranking mode is invalid');
    const page = bounded(args.page, 1, 1_000);
    const limit = bounded(args.limit, 20, 100);
    const contents = pick(
      await new PixivClient(context).raw(
        `/ranking.php?mode=${encodeURIComponent(mode)}&p=${page}&format=json`,
      ),
      'contents',
    );
    if (!Array.isArray(contents)) throw new Error('pixiv ranking response is malformed');
    return contents.slice(0, limit).map(value => {
      const item = object(value);
      const id = text(pick(item, 'illust_id'));
      return {
        rank: pick(item, 'rank') ?? 0,
        title: text(pick(item, 'title')),
        author: text(pick(item, 'user_name')),
        user_id: text(pick(item, 'user_id')),
        illust_id: id,
        pages: pick(item, 'illust_page_count') ?? 1,
        bookmarks: pick(item, 'illust_bookmark_count') ?? 0,
        url: `https://www.pixiv.net/artworks/${id}`,
      };
    });
  },
});
