import { defineCommand } from '@panerelay/site-kit';
import { limit, rss } from '../client.js';

export default defineCommand({
  name: 'news',
  description: 'Get Google News headlines through RSS.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Optional news search query.',
      type: 'string',
      positional: true,
    },
    { name: 'limit', description: 'Maximum headlines.', type: 'number', default: 10 },
    { name: 'lang', description: 'Language code.', type: 'string', default: 'en' },
    { name: 'region', description: 'Region code.', type: 'string', default: 'US' },
  ],
  output: ['title', 'source', 'date', 'url'],
  examples: ['panerelay google news --limit 5', 'panerelay google news AI --region US'],
  async run(context, args) {
    const take = limit(args.limit);
    const rawLanguage = String(args.lang || 'en').trim();
    const rawRegion = String(args.region || 'US')
      .trim()
      .toUpperCase();
    const locale = rawLanguage.includes('-') ? rawLanguage : `${rawLanguage}-${rawRegion}`;
    const language = encodeURIComponent(locale);
    const region = encodeURIComponent(rawRegion);
    const editionLanguage = encodeURIComponent(rawLanguage.split('-')[0] || 'en');
    const keyword = String(args.keyword ?? '').trim();
    const url = keyword
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${language}&gl=${region}&ceid=${region}:${editionLanguage}`
      : `https://news.google.com/rss?hl=${language}&gl=${region}&ceid=${region}:${editionLanguage}`;
    return (await rss(context, url, take)).map(row => ({
      title: row.title,
      source: row.source,
      date: row.date,
      url: row.url,
    }));
  },
});
