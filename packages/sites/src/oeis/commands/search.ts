import { defineCommand } from '@panerelay/site-kit';
import { boundedLimit, formatId, OeisClient, pick, preview, required } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search OEIS sequences by keyword or numeric pattern.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Keyword or comma-separated terms',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum sequences', type: 'number', default: 10 },
  ],
  output: ['rank', 'id', 'name', 'keywords', 'preview', 'author', 'created', 'url'],
  examples: ['panerelay oeis search fibonacci'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = boundedLimit(args.limit);
    const rows: unknown[] = [];
    for (let start = 0; rows.length < limit && start < limit + 10; start += 10) {
      const page = await new OeisClient(context).json('/search', {
        q: query,
        fmt: 'json',
        start: String(start),
      });
      const items = Array.isArray(page) ? page : [];
      rows.push(...items);
      if (items.length < 10) break;
    }
    if (!rows.length) throw new Error(`No OEIS sequences matched "${query}"`);
    return rows.slice(0, limit).map((row, index) => {
      const id = formatId(pick(row, 'number'));
      return {
        rank: index + 1,
        id,
        name: pick(row, 'name') ?? null,
        keywords: pick(row, 'keyword') ?? null,
        preview: preview(pick(row, 'data')),
        author: pick(row, 'author') ?? null,
        created: pick(row, 'created') ?? null,
        url: id ? `${'https://oeis.org'}/${id}` : '',
      };
    });
  },
});
