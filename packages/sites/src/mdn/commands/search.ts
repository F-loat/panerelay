import { defineCommand } from '@panerelay/site-kit';
import { BASE, MdnClient, limit, locale, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search MDN Web Docs by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results (1-50).', type: 'number', default: 10 },
    { name: 'locale', description: 'Document locale.', type: 'string', default: 'en-US' },
  ],
  output: ['rank', 'title', 'slug', 'locale', 'summary', 'url'],
  examples: ['panerelay mdn search fetch --limit 5'],
  async run(context, args) {
    const query = text(args.query);
    if (!query) throw new Error('mdn query cannot be empty');
    const language = locale(args.locale);
    const rows = (await new MdnClient(context).search(query, limit(args.limit), language))
      .documents;
    if (!Array.isArray(rows) || rows.length === 0)
      throw new Error(`mdn search returned no results for "${query}"`);
    return rows.slice(0, limit(args.limit)).map((row, index) => ({
      rank: index + 1,
      title: text((row as Record<string, unknown>).title),
      slug: text((row as Record<string, unknown>).slug),
      locale: text((row as Record<string, unknown>).locale) || language,
      summary: text((row as Record<string, unknown>).summary).replace(/\s+/g, ' '),
      url: `${BASE}${text((row as Record<string, unknown>).mdn_url)}`,
    }));
  },
});
