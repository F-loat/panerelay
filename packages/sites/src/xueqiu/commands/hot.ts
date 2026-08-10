import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, rows, stripHtml, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List hot Xueqiu posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 }],
  output: ['rank', 'author', 'text', 'likes', 'url'],
  examples: ['panerelay xueqiu hot --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 50);
    const payload = await new XueqiuClient(context).get(
      'https://xueqiu.com/statuses/hot/listV3.json?source=hot&page=1',
    );
    return rows(pick(payload, 'list'), 'hot posts')
      .slice(0, limit)
      .map((item, index) => {
        const user = object(pick(item, 'user'));
        return {
          rank: index + 1,
          author: text(pick(user, 'screen_name')),
          text: stripHtml(pick(item, 'description')).slice(0, 200),
          likes: pick(item, 'fav_count') ?? 0,
          url: `https://xueqiu.com/${text(pick(user, 'id'))}/${text(pick(item, 'id'))}`,
        };
      });
  },
});
