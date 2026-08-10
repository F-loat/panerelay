import { defineCommand } from '@panerelay/site-kit';
import { boundedLimit, language, WikipediaClient } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Wikipedia articles.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 10 },
    { name: 'lang', description: 'Wikipedia language code', type: 'string', default: 'en' },
  ],
  output: ['title', 'snippet', 'url'],
  examples: ['panerelay wikipedia search transformer --lang en'],
  async run(context, args) {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('wikipedia query cannot be empty');
    const lang = language(args.lang);
    const limit = boundedLimit(args.limit);
    const body = (await new WikipediaClient(context).json(lang, '/w/api.php', {
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: limit,
      format: 'json',
      utf8: 1,
    })) as Record<string, unknown>;
    const queryData = body.query as Record<string, unknown> | undefined;
    const rows = Array.isArray(queryData?.search) ? queryData.search : [];
    if (!rows.length) throw new Error('No Wikipedia articles found');
    return rows.map(row => {
      const item = row as Record<string, unknown>;
      const articleTitle = String(item.title ?? '');
      return {
        title: articleTitle,
        snippet: String(item.snippet ?? '')
          .replace(/<[^>]+>/g, '')
          .slice(0, 120),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(articleTitle.replace(/ /g, '_'))}`,
      };
    });
  },
});
