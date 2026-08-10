import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, rows, stripHtml, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'feed',
  description: 'List the logged-in Xueqiu home timeline.',
  access: 'read',
  args: [
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['author', 'text', 'likes', 'replies', 'url'],
  examples: ['panerelay xueqiu feed --page 1 --limit 20'],
  async run(context, args) {
    const page = bounded(args.page, 1, 1_000);
    const limit = bounded(args.limit, 20, 100);
    const payload = await new XueqiuClient(context).get(
      `https://xueqiu.com/v4/statuses/home_timeline.json?page=${page}&count=${limit}`,
    );
    const raw = pick(payload, 'home_timeline') ?? pick(payload, 'list');
    return rows(raw, 'timeline')
      .slice(0, limit)
      .map(item => {
        const user = object(pick(item, 'user'));
        return {
          author: text(pick(user, 'screen_name')),
          text: stripHtml(pick(item, 'description')).slice(0, 200),
          likes: pick(item, 'fav_count') ?? 0,
          replies: pick(item, 'reply_count') ?? 0,
          url: `https://xueqiu.com/${text(pick(user, 'id'))}/${text(pick(item, 'id'))}`,
        };
      });
  },
});
