import { defineCommand } from '@panerelay/site-kit';
import {
  GRAPH_BASE,
  numberOrNull,
  paperRef,
  paperRow,
  pick,
  SemanticScholarClient,
  tldr,
} from '../client.js';

const fields =
  'paperId,title,year,authors,citationCount,influentialCitationCount,referenceCount,tldr,externalIds,url';

export default defineCommand({
  name: 'paper',
  description: 'Fetch Semantic Scholar paper detail.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Paper ID, DOI, arXiv ID, or prefixed ID',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'paperId',
    'doi',
    'title',
    'year',
    'firstAuthor',
    'citationCount',
    'influentialCitationCount',
    'referenceCount',
    'tldr',
    'url',
  ],
  examples: ['panerelay semanticscholar paper 10.18653/v1/N19-1423'],
  async run(context, args) {
    const ref = paperRef(args.id);
    const body = await new SemanticScholarClient(context).request(
      `${GRAPH_BASE}/paper/${encodeURIComponent(ref)}`,
      [{ name: 'fields', value: fields }],
    );
    const row = paperRow(body, 'paper');
    return [
      {
        ...row,
        influentialCitationCount: numberOrNull(pick(body, 'influentialCitationCount')),
        referenceCount: numberOrNull(pick(body, 'referenceCount')),
        tldr: tldr(pick(body, 'tldr')),
      },
    ];
  },
});
