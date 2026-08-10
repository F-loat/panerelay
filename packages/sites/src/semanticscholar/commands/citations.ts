import { defineCommand } from '@panerelay/site-kit';
import { bounded, GRAPH_BASE, paperRef, paperRow, pick, SemanticScholarClient } from '../client.js';

const fields = 'paperId,title,year,authors,citationCount,externalIds';

export default defineCommand({
  name: 'citations',
  description: 'List papers citing a Semantic Scholar paper.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Paper ID, DOI, arXiv ID, or prefixed ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum citing papers', type: 'number', default: 20 },
    { name: 'offset', description: 'Zero-based result offset', type: 'number', default: 0 },
  ],
  output: ['rank', 'paperId', 'doi', 'title', 'year', 'firstAuthor', 'citationCount', 'url'],
  examples: ['panerelay semanticscholar citations 10.18653/v1/N19-1423 --limit 20'],
  async run(context, args) {
    const ref = paperRef(args.id);
    const limit = bounded(args.limit, 20, 1000);
    const offset = args.offset == null ? 0 : Number(args.offset);
    if (!Number.isInteger(offset) || offset < 0 || offset > 9999)
      throw new Error('semanticscholar offset must be an integer between 0 and 9999');
    const body = await new SemanticScholarClient(context).request(
      `${GRAPH_BASE}/paper/${encodeURIComponent(ref)}/citations`,
      [
        { name: 'fields', value: fields },
        { name: 'limit', value: String(limit) },
        { name: 'offset', value: String(offset) },
      ],
    );
    const rows = pick(body, 'data');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`semanticscholar no citations found at offset ${offset}`);
    return rows.slice(0, limit).map((entry, index) => {
      const citingPaper = pick(entry, 'citingPaper');
      return paperRow(citingPaper, 'citations', offset + index + 1);
    });
  },
});
