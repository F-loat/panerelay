import { defineCommand } from '@panerelay/site-kit';
import { boundedLimit, DESC_MAX_LEN, language, WikipediaClient } from '../client.js';

export default defineCommand({
  name: 'trending',
  description: 'List most-read Wikipedia articles from yesterday.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum results', type: 'number', default: 10 },
    { name: 'lang', description: 'Wikipedia language code', type: 'string', default: 'en' },
  ],
  output: ['rank', 'title', 'description', 'views'],
  examples: ['panerelay wikipedia trending --limit 10'],
  async run(context, args) {
    const lang = language(args.lang);
    const limit = boundedLimit(args.limit);
    const date = new Date(Date.now() - 86_400_000);
    const path = `/api/rest_v1/feed/featured/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
    const body = (await new WikipediaClient(context).json(lang, path)) as Record<string, unknown>;
    const mostread = body.mostread as Record<string, unknown> | undefined;
    const articles = Array.isArray(mostread?.articles) ? mostread.articles : [];
    if (!articles.length) throw new Error('No trending Wikipedia articles available');
    return articles.slice(0, limit).map((article, index) => {
      const item = article as Record<string, unknown>;
      const articleTitle = String(item.title ?? '').trim();
      if (!articleTitle) throw new Error('Wikipedia trending returned an article without title');
      return {
        rank: index + 1,
        title: articleTitle,
        description: String(item.description ?? '').slice(0, DESC_MAX_LEN),
        views: Number(item.views ?? 0),
      };
    });
  },
});
