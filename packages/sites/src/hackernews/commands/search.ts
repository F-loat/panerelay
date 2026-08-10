import { defineCommand } from '@panerelay/site-kit';
import {
  HackerNewsClient,
  isObject,
  positiveInteger,
  requiredString,
  storyRow,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Hacker News stories.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of results, up to 50', type: 'number', default: 20 },
    {
      name: 'sort',
      description: 'Sort by relevance or date',
      type: 'string',
      default: 'relevance',
    },
  ],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'url'],
  examples: ['panerelay hackernews search "browser automation" --limit 10'],
  async run(context, args) {
    const client = new HackerNewsClient(context);
    const query = requiredString(args, 'query');
    const limit = positiveInteger(args.limit, 'Hacker News search limit', 20);
    const sort = args.sort === 'date' ? 'search_by_date' : 'search';
    const payload = await client.search(`/${sort}`, { query, tags: 'story', hitsPerPage: limit });
    if (!isObject(payload) || !Array.isArray(payload.hits))
      throw new Error('Hacker News search response is malformed');
    return payload.hits
      .slice(0, limit)
      .filter(isObject)
      .map((item, index) =>
        storyRow(
          {
            id: item.objectID,
            title: item.title,
            score: item.points,
            by: item.author,
            descendants: item.num_comments,
            url: item.url,
          },
          index + 1,
        ),
      );
  },
});
