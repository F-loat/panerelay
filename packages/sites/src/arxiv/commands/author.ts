import { defineCommand } from '@panerelay/site-kit';
import { ArxivClient, listing, positiveInteger, requiredString } from '../client.js';

export default defineCommand({
  name: 'author',
  description: 'List arXiv papers by an author.',
  access: 'read',
  args: [
    {
      name: 'author',
      description: 'Author name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results, up to 50', type: 'number', default: 20 },
  ],
  output: ['id', 'title', 'authors', 'published', 'primary_category', 'url'],
  examples: ['panerelay arxiv author "Yoshua Bengio"'],
  async run(context, args) {
    const author = requiredString(args, 'author');
    const limit = positiveInteger(args.limit, 'arXiv author limit', 20, 50);
    const papers = await new ArxivClient(context).query({
      search_query: `au:"${author}"`,
      max_results: limit,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });
    if (!papers.length) throw new Error(`No arXiv papers found for ${author}`);
    return listing(papers);
  },
});
