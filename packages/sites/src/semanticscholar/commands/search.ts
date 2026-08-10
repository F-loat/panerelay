import { defineCommand } from '@panerelay/site-kit';
import { bounded, GRAPH_BASE, paperRow, pick, required, SemanticScholarClient } from '../client.js';

const fields = 'paperId,title,year,authors,citationCount,externalIds';

export default defineCommand({
  name: 'search',
  description: 'Search Semantic Scholar papers by free text.',
  access: 'read',
  args: [
    { name: 'query', description: 'Search text', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'paperId', 'doi', 'title', 'year', 'firstAuthor', 'citationCount', 'url'],
  examples: ['panerelay semanticscholar search "attention is all you need" --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = bounded(args.limit, 20, 100);
    const body = await new SemanticScholarClient(context).request(`${GRAPH_BASE}/paper/search`, [
      { name: 'query', value: query },
      { name: 'limit', value: String(limit) },
      { name: 'fields', value: fields },
    ]);
    const rows = pick(body, 'data');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`semanticscholar no papers matched "${query}"`);
    return rows.slice(0, limit).map((row, index) => paperRow(row, 'search', index + 1));
  },
});
