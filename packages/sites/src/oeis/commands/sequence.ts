import { defineCommand } from '@panerelay/site-kit';
import { formatId, OeisClient, pick, preview, sequenceId, text } from '../client.js';

export default defineCommand({
  name: 'sequence',
  description: 'Fetch full OEIS sequence metadata by A-number.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'OEIS sequence id',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'id',
    'name',
    'keywords',
    'preview',
    'termCount',
    'offset',
    'author',
    'created',
    'revision',
    'commentCount',
    'formulaCount',
    'referenceCount',
    'xrefCount',
    'linkCount',
    'url',
  ],
  examples: ['panerelay oeis sequence A000045'],
  async run(context, args) {
    const id = sequenceId(args.id);
    const body = await new OeisClient(context).json('/search', { q: `id:${id}`, fmt: 'json' });
    const row = Array.isArray(body) ? body[0] : undefined;
    if (!row) throw new Error(`OEIS sequence "${id}" not found`);
    const data = text(pick(row, 'data'));
    const count = data ? data.split(',').filter(Boolean).length : 0;
    const canonical = formatId(pick(row, 'number')) || id;
    const countOf = (key: string) =>
      Array.isArray(pick(row, key)) ? (pick(row, key) as unknown[]).length : 0;
    return [
      {
        id: canonical,
        name: pick(row, 'name') ?? null,
        keywords: pick(row, 'keyword') ?? null,
        preview: preview(data),
        termCount: count,
        offset: pick(row, 'offset') ?? null,
        author: pick(row, 'author') ?? null,
        created: pick(row, 'created') ?? null,
        revision: pick(row, 'revision') ?? null,
        commentCount: countOf('comment'),
        formulaCount: countOf('formula'),
        referenceCount: countOf('reference'),
        xrefCount: countOf('xref'),
        linkCount: countOf('link'),
        url: `https://oeis.org/${canonical}`,
      },
    ];
  },
});
