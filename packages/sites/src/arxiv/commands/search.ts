import { defineCommand } from '@panerelay/site-kit';
import { ArxivClient, listing, positiveInteger, requiredString } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search arXiv papers.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results, up to 25', type: 'number', default: 10 },
  ],
  output: ['id', 'title', 'authors', 'published', 'primary_category', 'url'],
  examples: ['panerelay arxiv search "attention is all you need"'],
  async run(context, args) {
    const query = requiredString(args, 'query');
    const limit = positiveInteger(args.limit, 'arXiv search limit', 10, 25);
    const papers = await new ArxivClient(context).query({
      search_query: `all:${query}`,
      max_results: limit,
      sortBy: 'relevance',
    });
    if (!papers.length) throw new Error('No arXiv papers found');
    return listing(papers);
  },
});
