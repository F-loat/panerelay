import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, rows, stripHtml, symbol, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'comments',
  description: 'List discussion posts for a stock symbol.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['author', 'text', 'likes', 'replies', 'retweets', 'created_at', 'url'],
  examples: ['panerelay xueqiu comments SH600519 --limit 20'],
  async run(context, args) {
    const selected = symbol(args.symbol);
    const limit = bounded(args.limit, 20, 100);
    const pageSize = Math.min(limit, 20);
    const client = new XueqiuClient(context);
    const output: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= 5 && output.length < limit; page += 1) {
      const payload = await client.get(
        `https://xueqiu.com/query/v1/symbol/search/status?symbol=${encodeURIComponent(selected)}&count=${pageSize}&page=${page}&sort=time`,
        `https://xueqiu.com/S/${selected}`,
      );
      const raw = Array.isArray(pick(payload, 'list'))
        ? rows(pick(payload, 'list'), 'comments')
        : rows(pick(pick(payload, 'data'), 'list'), 'comments');
      if (!raw.length) break;
      for (const value of raw) {
        const id = text(pick(value, 'id'));
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const user = object(pick(value, 'user'));
        const userId = text(pick(user, 'id'));
        const created = new Date(Number(pick(value, 'created_at')));
        output.push({
          author: text(pick(user, 'screen_name')),
          text: stripHtml(pick(value, 'description')),
          likes: Number(pick(value, 'fav_count') ?? 0) || 0,
          replies: Number(pick(value, 'reply_count') ?? 0) || 0,
          retweets: Number(pick(value, 'retweet_count') ?? 0) || 0,
          created_at: Number.isNaN(created.getTime()) ? null : created.toISOString(),
          url: userId ? `https://xueqiu.com/${userId}/${id}` : null,
        });
      }
      if (raw.length < pageSize) break;
    }
    if (!output.length) throw new Error(`xueqiu found no discussions for ${selected}`);
    return output.slice(0, limit);
  },
});
