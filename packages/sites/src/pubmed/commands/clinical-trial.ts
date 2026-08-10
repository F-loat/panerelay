import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, PubMedClient, required, searchQuery } from '../client.js';
import { executeSearch } from './search.js';

export default defineCommand({
  name: 'clinical-trial',
  description: 'Search PubMed clinical trials.',
  access: 'read',
  args: [
    { name: 'query', description: 'Topic query', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'year-from', description: 'Start year', type: 'number' },
    { name: 'year-to', description: 'End year', type: 'number' },
    {
      name: 'free-full-text',
      description: 'Require free full text',
      type: 'boolean',
      default: false,
    },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'date' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed clinical-trial cancer'],
  async run(context, args) {
    const query = required(args.query, 'query');
    return executeSearch(
      new PubMedClient(context),
      searchQuery(query, {
        type: 'Clinical Trial',
        from: args['year-from'],
        to: args['year-to'],
        fullText: args['free-full-text'],
        humans: true,
      }),
      bounded(args.limit),
      choice(args.sort, ['date', 'relevance'], 'date', 'sort'),
    );
  },
});
