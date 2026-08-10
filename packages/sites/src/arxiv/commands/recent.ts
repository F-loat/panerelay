import { defineCommand } from '@panerelay/site-kit';
import { ArxivClient, listing, positiveInteger, requiredString } from '../client.js';

export default defineCommand({
  name: 'recent',
  description: 'List recent arXiv submissions in a category.',
  access: 'read',
  args: [
    {
      name: 'category',
      description: 'arXiv category, for example cs.CL',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results, up to 50', type: 'number', default: 10 },
  ],
  output: ['id', 'title', 'authors', 'published', 'primary_category', 'url'],
  examples: ['panerelay arxiv recent cs.CL --limit 10'],
  async run(context, args) {
    const category = requiredString(args, 'category');
    if (!/^[a-z]+(?:-[a-z]+)*(?:\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?$/.test(category))
      throw new Error(`Invalid arXiv category: ${category}`);
    const limit = positiveInteger(args.limit, 'arXiv recent limit', 10, 50);
    const papers = await new ArxivClient(context).query({
      search_query: `cat:${category}`,
      max_results: limit,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });
    if (!papers.length) throw new Error(`No recent arXiv papers in ${category}`);
    return listing(papers);
  },
});
