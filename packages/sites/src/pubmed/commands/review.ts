import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, PubMedClient, required, searchQuery } from '../client.js';
import { executeSearch } from './search.js';

export default defineCommand({
  name: 'review',
  description: 'Search PubMed review articles.',
  access: 'read',
  args: [
    { name: 'query', description: 'Topic query', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'year-from', description: 'Start year', type: 'number' },
    { name: 'year-to', description: 'End year', type: 'number' },
    { name: 'has-abstract', description: 'Require an abstract', type: 'boolean', default: false },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'date' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed review immunotherapy'],
  async run(context, args) {
    const query = required(args.query, 'query');
    return executeSearch(
      new PubMedClient(context),
      searchQuery(query, {
        type: 'Review',
        from: args['year-from'],
        to: args['year-to'],
        abstract: args['has-abstract'],
      }),
      bounded(args.limit),
      choice(args.sort, ['date', 'relevance'], 'date', 'sort'),
    );
  },
});
