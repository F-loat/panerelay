import { defineCommand } from '@panerelay/site-kit';
import { formatSummary, language, WikipediaClient } from '../client.js';

export default defineCommand({
  name: 'random',
  description: 'Get a random Wikipedia article.',
  access: 'read',
  args: [{ name: 'lang', description: 'Wikipedia language code', type: 'string', default: 'en' }],
  output: ['title', 'description', 'extract', 'url'],
  examples: ['panerelay wikipedia random --lang zh'],
  async run(context, args) {
    const lang = language(args.lang);
    const body = (await new WikipediaClient(context).json(
      lang,
      '/api/rest_v1/page/random/summary',
    )) as Record<string, unknown>;
    if (!body.title) throw new Error('No random Wikipedia article returned');
    return [formatSummary(body, lang)];
  },
});
