import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, PubMedClient, required, searchQuery, text } from '../client.js';
import { executeSearch } from './search.js';

export default defineCommand({
  name: 'author',
  description: 'Search PubMed articles by author.',
  access: 'read',
  args: [
    { name: 'name', description: 'Author name', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'affiliation', description: 'Affiliation filter', type: 'string' },
    { name: 'position', description: 'Author position', type: 'string', default: 'any' },
    { name: 'year-from', description: 'Start year', type: 'number' },
    { name: 'year-to', description: 'End year', type: 'number' },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'date' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed author "Smith J" --position first'],
  async run(context, args) {
    const name = required(args.name, 'author');
    const limit = bounded(args.limit);
    const position = choice(args.position, ['any', 'first', 'last'], 'any', 'position');
    const sort = choice(args.sort, ['date', 'relevance'], 'date', 'sort');
    const tag = position === 'first' ? '1au' : position === 'last' ? 'lastau' : 'au';
    const affiliation = args.affiliation ? `${text(args.affiliation)}[ad]` : '';
    const query = searchQuery(`${name}[${tag}]${affiliation ? ` AND ${affiliation}` : ''}`, {
      from: args['year-from'],
      to: args['year-to'],
    });
    return executeSearch(new PubMedClient(context), query, limit, sort);
  },
});
