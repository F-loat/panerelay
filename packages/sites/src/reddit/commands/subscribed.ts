import { defineCommand } from '@panerelay/site-kit';
import { bounded, object, pick, RedditClient, text, type Value } from '../client.js';

export default defineCommand({
  name: 'subscribed',
  description: 'List subscribed subreddits.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 100 }],
  output: ['id', 'subreddit', 'title', 'subscribers', 'description', 'url'],
  examples: ['panerelay reddit subscribed --limit 100'],
  async run(context, args) {
    const client = new RedditClient(context);
    await client.me();
    const limit = bounded(args.limit, 100, 1_000);
    const entries: Value[] = [];
    let after = '';
    const seen = new Set<string>();
    for (let page = 0; page < 20 && entries.length < limit; page += 1) {
      const pageLimit = Math.min(100, limit - entries.length);
      const query = new URLSearchParams({ limit: String(pageLimit), raw_json: '1' });
      if (after) query.set('after', after);
      const payload = object(await client.get(`/subreddits/mine/subscriptions.json?${query}`));
      const children = pick(pick(payload, 'data'), 'children');
      if (!Array.isArray(children)) throw new Error('reddit subscriptions response is malformed');
      entries.push(...children.map(object));
      const next = text(pick(pick(payload, 'data'), 'after'));
      if (!next) break;
      if (seen.has(next)) throw new Error('reddit subscriptions repeated a pagination cursor');
      seen.add(next);
      after = next;
    }
    return entries.slice(0, limit).map((entry, index) => {
      const data = object(pick(entry, 'data'));
      const display = text(pick(data, 'display_name'));
      const id =
        text(pick(data, 'name')) ||
        (pick(entry, 'kind') === 't5' ? `t5_${text(pick(data, 'id'))}` : '');
      const path = text(pick(data, 'url'));
      if (!id || !display || !path)
        throw new Error(`reddit subscription row ${index + 1} is malformed`);
      return {
        id,
        subreddit: text(pick(data, 'display_name_prefixed')) || `r/${display}`,
        title: text(pick(data, 'title')),
        subscribers: pick(data, 'subscribers') ?? null,
        description: text(pick(data, 'public_description')).slice(0, 200),
        url: `https://www.reddit.com${path}`,
      };
    });
  },
});
