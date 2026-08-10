import { defineCommand } from '@panerelay/site-kit';
import { ApplePodcastsClient, ITUNES_BASE, limit, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Apple Podcasts.',
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
  ],
  output: ['id', 'title', 'author', 'episodes', 'genre', 'url'],
  examples: ['panerelay apple-podcasts search technology --limit 5'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const count = limit(args.limit, 10, 25);
    const body = (await new ApplePodcastsClient(context).json(`${ITUNES_BASE}/search`, [
      { name: 'term', value: query },
      { name: 'media', value: 'podcast' },
      { name: 'limit', value: count },
    ])) as Record<string, unknown>;
    const results = Array.isArray(body.results) ? body.results : [];
    if (!results.length) throw new Error(`No Apple Podcasts found for "${query}"`);
    return results.map(item => {
      const podcast = item as Record<string, unknown>;
      return {
        id: podcast.collectionId ?? podcast.trackId ?? null,
        title: text(podcast.collectionName),
        author: text(podcast.artistName),
        episodes: podcast.trackCount ?? '',
        genre: text(podcast.primaryGenreName),
        url: text(podcast.collectionViewUrl),
      };
    });
  },
});
