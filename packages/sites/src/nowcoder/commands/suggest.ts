import { defineCommand } from '@panerelay/site-kit';
import { NowCoderClient, object, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'suggest',
  description: 'List NowCoder search suggestions.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['rank', 'suggestion', 'type'],
  examples: ['panerelay nowcoder suggest Java'],
  async run(context, args) {
    const response = await new NowCoderClient(context).post('search/suggest', {
      query: required(args.query, 'query'),
    });
    const records = pick(pick(response, 'data'), 'records');
    if (!Array.isArray(records)) throw new Error('nowcoder suggestions response is malformed');
    return records.slice(0, 10).map((value, index) => {
      const item = object(value);
      return {
        rank: index + 1,
        suggestion: text(pick(item, 'name')),
        type: text(pick(item, 'typeName')) || 'general',
      };
    });
  },
});
