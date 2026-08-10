import { defineCommand } from '@panerelay/site-kit';
import { limit, pick, rows, text, V2exClient } from '../client.js';

export default defineCommand({
  name: 'nodes',
  description: 'List V2EX nodes by topic count.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum nodes.', type: 'number', default: 30 }],
  output: ['rank', 'name', 'title', 'topics', 'stars'],
  examples: ['panerelay v2ex nodes --limit 30'],
  async run(context, args) {
    const take = limit(args.limit, 30, 500);
    return rows(await new V2exClient(context).get('nodes/all.json'), 'v2ex nodes')
      .sort((a, b) => Number(pick(b, 'topics')) - Number(pick(a, 'topics')))
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        name: text(pick(item, 'name')),
        title: text(pick(item, 'title')),
        topics: pick(item, 'topics') ?? 0,
        stars: pick(item, 'stars') ?? 0,
      }));
  },
});
