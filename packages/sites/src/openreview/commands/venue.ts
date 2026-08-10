import { defineCommand } from '@panerelay/site-kit';
import { OpenReviewClient, limit, noteRow, offset, required } from '../client.js';
export default defineCommand({
  name: 'venue',
  description: 'List papers at an OpenReview venue or invitation.',
  access: 'read',
  args: [
    {
      name: 'venue',
      description: 'Venue name or invitation',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 25 },
    { name: 'offset', description: 'Pagination offset', type: 'number', default: 0 },
  ],
  output: ['rank', 'id', 'title', 'authors', 'keywords', 'primary_area', 'pdate', 'pdf', 'url'],
  examples: ['panerelay openreview venue ICLR 2024 oral'],
  async run(context, args) {
    const value = required(args.venue, 'venue');
    const take = limit(args.limit, 25, 200);
    const start = offset(args.offset);
    const filter = value.includes('/-/')
      ? `invitation=${encodeURIComponent(value)}`
      : `content.venue=${encodeURIComponent(value)}`;
    const body = (await new OpenReviewClient(context).json(
      `/notes?${filter}&limit=${take}&offset=${start}`,
    )) as { notes?: unknown[] } | null;
    const notes = body?.notes ?? [];
    if (!notes.length) throw new Error(`No OpenReview papers found at venue "${value}"`);
    return notes.slice(0, take).map((note, index) => {
      const row = noteRow(note);
      return {
        rank: start + index + 1,
        id: row.id,
        title: row.title,
        authors: row.authors,
        keywords: row.keywords,
        primary_area: row.primary_area,
        pdate: row.pdate,
        pdf: row.pdf,
        url: row.url,
      };
    });
  },
});
