import { defineCommand } from '@panerelay/site-kit';
import { OpenReviewClient, forumId, noteRow } from '../client.js';
export default defineCommand({
  name: 'paper',
  description: 'Show full metadata for one OpenReview paper.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'OpenReview note ID',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'id',
    'title',
    'authors',
    'keywords',
    'venue',
    'venueid',
    'primary_area',
    'abstract',
    'pdate',
    'pdf',
    'url',
  ],
  examples: ['panerelay openreview paper 5sRnsubyAK'],
  async run(context, args) {
    const id = forumId(args.id);
    const body = (await new OpenReviewClient(context).json(
      `/notes?id=${encodeURIComponent(id)}`,
    )) as { notes?: unknown[] } | null;
    const note = body?.notes?.[0];
    if (!note) throw new Error(`No OpenReview paper found with id "${id}"`);
    return [noteRow(note)];
  },
});
