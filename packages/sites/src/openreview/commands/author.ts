import { defineCommand } from '@panerelay/site-kit';
import { OpenReviewClient, limit, noteRow, profileId } from '../client.js';
export default defineCommand({
  name: 'author',
  description: 'List OpenReview submissions by an author profile.',
  access: 'read',
  args: [
    {
      name: 'profile',
      description: 'OpenReview profile ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum submissions', type: 'number', default: 50 },
  ],
  output: ['rank', 'id', 'title', 'authors', 'venue', 'pdate', 'url'],
  examples: ['panerelay openreview author ~Yoshua_Bengio1'],
  async run(context, args) {
    const profile = profileId(args.profile);
    const take = limit(args.limit, 50, 1000);
    const body = (await new OpenReviewClient(context).json(
      `/notes?content.authorids=${encodeURIComponent(profile)}&limit=${take}&sort=cdate:desc`,
    )) as { notes?: unknown[] } | null;
    const notes = body?.notes ?? [];
    if (!notes.length) throw new Error(`No OpenReview submissions found for profile "${profile}"`);
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
