import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, PubMedClient, searchQuery, text, year } from '../client.js';
import { executeSearch } from './search.js';

export default defineCommand({
  name: 'journal',
  description: 'Search PubMed articles by journal.',
  access: 'read',
  args: [
    {
      name: 'journal',
      description: 'Journal name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'year-from', description: 'Start year', type: 'number' },
    { name: 'year-to', description: 'End year', type: 'number' },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'relevance' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed journal Nature --year-from 2020'],
  async run(context, args) {
    const name = text(args.journal);
    if (!name) throw new Error('pubmed journal cannot be empty');
    year(args['year-from'], 'year-from');
    year(args['year-to'], 'year-to');
    return executeSearch(
      new PubMedClient(context),
      searchQuery(`${name}[Journal]`, { from: args['year-from'], to: args['year-to'] }),
      bounded(args.limit),
      choice(args.sort, ['relevance', 'date'], 'relevance', 'sort'),
    );
  },
});
