import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, PubMedClient, required, searchQuery } from '../client.js';
import { executeSearch } from './search.js';

export default defineCommand({
  name: 'mesh',
  description: 'Search PubMed articles by MeSH term.',
  access: 'read',
  args: [
    { name: 'term', description: 'MeSH term', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'major', description: 'Require major topic', type: 'boolean', default: false },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'relevance' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed mesh Neoplasms --major'],
  async run(context, args) {
    const term = required(args.term, 'term');
    const tag = args.major ? 'Majr' : 'MeSH Terms';
    return executeSearch(
      new PubMedClient(context),
      searchQuery(`${term}[${tag}]`),
      bounded(args.limit),
      choice(args.sort, ['relevance', 'date'], 'relevance', 'sort'),
    );
  },
});
