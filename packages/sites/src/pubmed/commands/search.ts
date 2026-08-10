import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  choice,
  PubMedClient,
  pick,
  searchQuery,
  summaries,
  text,
  year,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search PubMed articles with filters.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'author', description: 'Author filter', type: 'string' },
    { name: 'journal', description: 'Journal filter', type: 'string' },
    { name: 'year-from', description: 'Start year', type: 'number' },
    { name: 'year-to', description: 'End year', type: 'number' },
    { name: 'article-type', description: 'Publication type', type: 'string' },
    { name: 'has-abstract', description: 'Require abstract', type: 'boolean', default: false },
    {
      name: 'free-full-text',
      description: 'Require free full text',
      type: 'boolean',
      default: false,
    },
    { name: 'humans-only', description: 'Require human studies', type: 'boolean', default: false },
    { name: 'english-only', description: 'Require English', type: 'boolean', default: false },
    { name: 'sort', description: 'Sort order', type: 'string', default: 'relevance' },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed search "machine learning cancer" --limit 10'],
  async run(context, args) {
    const limit = bounded(args.limit);
    const sort = choice(args.sort, ['relevance', 'date', 'author', 'journal'], 'relevance', 'sort');
    const query = searchQuery(args.query, {
      author: args.author,
      journal: args.journal,
      from: args['year-from'],
      to: args['year-to'],
      type: args['article-type'],
      abstract: args['has-abstract'],
      fullText: args['free-full-text'],
      humans: args['humans-only'],
      english: args['english-only'],
    });
    year(args['year-from'], 'year-from');
    year(args['year-to'], 'year-to');
    return executeSearch(new PubMedClient(context), query, limit, sort);
  },
});

export async function executeSearch(
  client: PubMedClient,
  query: string,
  limit: number,
  sort: string,
) {
  const body = await client.request('esearch', [
    { name: 'db', value: 'pubmed' },
    { name: 'retmode', value: 'json' },
    { name: 'term', value: query },
    { name: 'retmax', value: String(limit) },
    {
      name: 'sort',
      value:
        sort === 'date'
          ? 'pub_date'
          : sort === 'author'
            ? 'Author'
            : sort === 'journal'
              ? 'JournalName'
              : '',
    },
  ]);
  const result = pick(body, 'esearchresult');
  const ids = pick(result, 'idlist');
  if (!Array.isArray(ids)) throw new Error('pubmed search did not return an id list');
  if (!ids.length) throw new Error(`pubmed no articles matched "${query}"`);
  return summaries(client, ids.slice(0, limit).map(text));
}
