import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'tags',
  description: 'List Linux.do tags.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 30 }],
  output: ['rank', 'name', 'slug', 'count', 'url'],
  examples: ['panerelay linux-do tags --limit 30'],
  async run(context, args) {
    const limit = bounded(args.limit, 30, 100);
    const raw = pick(await new LinuxDoClient(context).get('/tags.json'), 'tags');
    if (!Array.isArray(raw)) throw new Error('linux-do tags response is malformed');
    return raw
      .map(object)
      .sort((left, right) => Number(pick(right, 'count') ?? 0) - Number(pick(left, 'count') ?? 0))
      .slice(0, limit)
      .map((tag, index) => ({
        rank: index + 1,
        name: text(pick(tag, 'name')) || text(pick(tag, 'id')),
        slug: text(pick(tag, 'slug')),
        count: pick(tag, 'count') ?? 0,
        url: `https://linux.do/tag/${encodeURIComponent(text(pick(tag, 'slug')))}`,
      }));
  },
});
