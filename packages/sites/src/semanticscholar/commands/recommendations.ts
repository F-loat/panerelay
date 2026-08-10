import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  paperRef,
  paperRow,
  pick,
  RECOMMENDATIONS_BASE,
  SemanticScholarClient,
} from '../client.js';

const fields = 'paperId,title,year,authors,citationCount,externalIds';

export default defineCommand({
  name: 'recommendations',
  description: 'Fetch Semantic Scholar related paper recommendations.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Paper ID, DOI, arXiv ID, or prefixed ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum recommendations', type: 'number', default: 10 },
  ],
  output: ['rank', 'paperId', 'doi', 'title', 'year', 'firstAuthor', 'citationCount', 'url'],
  examples: ['panerelay semanticscholar recommendations 10.18653/v1/N19-1423 --limit 10'],
  async run(context, args) {
    const ref = paperRef(args.id);
    const limit = bounded(args.limit, 10, 500);
    const body = await new SemanticScholarClient(context).request(
      `${RECOMMENDATIONS_BASE}/papers/forpaper/${encodeURIComponent(ref)}`,
      [
        { name: 'fields', value: fields },
        { name: 'limit', value: String(limit) },
      ],
    );
    const rows = pick(body, 'recommendedPapers');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`semanticscholar no recommendations found for "${args.id}"`);
    return rows.slice(0, limit).map((row, index) => paperRow(row, 'recommendations', index + 1));
  },
});
