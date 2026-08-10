import { defineCommand } from '@panerelay/site-kit';
import {
  ApplePodcastsClient,
  ITUNES_BASE,
  formatDate,
  formatDuration,
  limit,
  required,
  text,
} from '../client.js';

export default defineCommand({
  name: 'episodes',
  description: 'List recent episodes of an Apple Podcast.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Podcast collection ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum episodes', type: 'number', default: 15 },
  ],
  output: ['title', 'duration', 'date'],
  examples: ['panerelay apple-podcasts episodes 123456789 --limit 10'],
  async run(context, args) {
    const id = required(args.id, 'podcast id');
    const count = limit(args.limit, 15, 200);
    const body = (await new ApplePodcastsClient(context).json(`${ITUNES_BASE}/lookup`, [
      { name: 'id', value: id },
      { name: 'entity', value: 'podcastEpisode' },
      { name: 'limit', value: count + 1 },
    ])) as Record<string, unknown>;
    const episodes = (Array.isArray(body.results) ? body.results : []).filter(
      item => (item as Record<string, unknown>).kind === 'podcast-episode',
    );
    if (!episodes.length) throw new Error(`No episodes found for podcast "${id}"`);
    return episodes.slice(0, count).map(item => {
      const episode = item as Record<string, unknown>;
      return {
        title: text(episode.trackName),
        duration: formatDuration(episode.trackTimeMillis),
        date: formatDate(episode.releaseDate),
      };
    });
  },
});
