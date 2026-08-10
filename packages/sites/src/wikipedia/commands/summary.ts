import { defineCommand } from '@panerelay/site-kit';
import { formatSummary, language, title, WikipediaClient } from '../client.js';

export default defineCommand({
  name: 'summary',
  description: 'Get a Wikipedia article summary.',
  access: 'read',
  args: [
    {
      name: 'title',
      description: 'Article title',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'lang', description: 'Wikipedia language code', type: 'string', default: 'en' },
  ],
  output: ['title', 'description', 'extract', 'url'],
  examples: ['panerelay wikipedia summary "Transformer (machine learning model)"'],
  async run(context, args) {
    const lang = language(args.lang);
    const articleTitle = title(args.title).replace(/ /g, '_');
    const body = (await new WikipediaClient(context).json(
      lang,
      `/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`,
    )) as Record<string, unknown>;
    if (!body.title) throw new Error(`Article "${args.title}" not found`);
    return [formatSummary(body, lang)];
  },
});
