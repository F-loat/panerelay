import { defineCommand } from '@panerelay/site-kit';
import { ApplePodcastsClient, CHARTS_BASE, limit, text } from '../client.js';

export default defineCommand({
  name: 'top',
  description: 'Get the Apple Podcasts top chart.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Number of podcasts', type: 'number', default: 20 },
    { name: 'country', description: 'Apple country code', type: 'string', default: 'us' },
  ],
  output: ['rank', 'title', 'author', 'id'],
  examples: ['panerelay apple-podcasts top --country us --limit 20'],
  async run(context, args) {
    const count = limit(args.limit, 20, 100);
    const country = text(args.country).toLowerCase() || 'us';
    if (!/^[a-z]{2,3}$/.test(country))
      throw new Error('apple-podcasts country must be a 2-3 letter code');
    const body = (await new ApplePodcastsClient(context).json(
      `${CHARTS_BASE}/${country}/podcasts/top/${count}/podcasts.json`,
    )) as Record<string, unknown>;
    const results = (body.feed as Record<string, unknown> | undefined)?.results ?? [];
    if (!Array.isArray(results) || !results.length)
      throw new Error(`No Apple Podcasts chart data found for ${country}`);
    return results.map((item, index) => {
      const podcast = item as Record<string, unknown>;
      return {
        rank: index + 1,
        title: text(podcast.name),
        author: text(podcast.artistName),
        id: text(podcast.id),
      };
    });
  },
});
