import { defineCommand } from '@panerelay/site-kit';
import { OpenReviewClient, limit, noteRow, required } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search OpenReview papers by free-text query.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 25 },
  ],
  output: ['rank', 'id', 'title', 'authors', 'venue', 'pdate', 'url'],
  examples: ['panerelay openreview search diffusion'],
  async run(context, args) {
    const query = required(args.query, 'search query');
    const take = limit(args.limit, 25, 50);
    const body = (await new OpenReviewClient(context).json(
      `/notes/search?term=${encodeURIComponent(query)}&type=terms&limit=${take}`,
    )) as { notes?: unknown[] } | null;
    const notes = body?.notes ?? [];
    if (!notes.length) throw new Error(`No OpenReview papers found for "${query}"`);
    return notes.slice(0, take).map((note, index) => {
      const row = noteRow(note);
      return {
        rank: index + 1,
        id: row.id,
        title: row.title,
        authors: row.authors,
        venue: row.venue,
        pdate: row.pdate,
        url: row.url,
      };
    });
  },
});
