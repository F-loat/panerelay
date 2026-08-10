import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, object, pick, required, stripHtml, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search NowCoder posts, questions, users, and jobs.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'type', description: 'Search type.', type: 'string', default: 'all' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'author', 'school', 'content', 'id'],
  examples: ['panerelay nowcoder search Java --type all --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const type = text(args.type) || 'all';
    const limit = bounded(args.limit, 10, 100);
    const response = await new NowCoderClient(context).post('pc/search', {
      query,
      type,
      page: 1,
      pageSize: limit,
    });
    const records = pick(pick(response, 'data'), 'records');
    if (!Array.isArray(records)) throw new Error('nowcoder search response is malformed');
    return records
      .map((value, index) => {
        const data = object(pick(object(value), 'data'));
        const moment = object(pick(data, 'momentData'));
        const content = object(pick(data, 'contentData'));
        const user = object(pick(data, 'userBrief'));
        return {
          rank: index + 1,
          title:
            text(pick(moment, 'title')) ||
            text(pick(content, 'title')) ||
            text(pick(user, 'nickname')),
          author: text(pick(user, 'nickname')),
          school: text(pick(user, 'educationInfo')),
          content: stripHtml(pick(moment, 'content') ?? pick(content, 'content')),
          id: pick(moment, 'uuid') ?? pick(content, 'uuid') ?? pick(data, 'contentId') ?? '',
        };
      })
      .filter(item => item.title)
      .slice(0, limit);
  },
});
