import { defineCommand } from '@panerelay/site-kit';
import { bounded, gql, pick, text } from './_shared/client.js';
export default defineCommand({
  name: 'sequences',
  description: 'List LessWrong post sequences.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author'],
  examples: ['panerelay lesswrong sequences --limit 5'],
  async run(context, args) {
    const limit = bounded(args.limit, 10);
    const data = await gql(
      context,
      `query Sequences { sequences(input: {terms: {view: "communitySequences", limit: ${limit}}}) { results { _id title user { displayName } } } }`,
    );
    const rows = pick(pick(data, 'sequences'), 'results');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('lesswrong sequences returned no results');
    return rows.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      title: text(pick(row, 'title')),
      author: text(pick(pick(row, 'user'), 'displayName')),
    }));
  },
});
