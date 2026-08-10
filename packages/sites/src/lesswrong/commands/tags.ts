import { defineCommand } from '@panerelay/site-kit';
import { bounded, gql, pick, text } from './_shared/client.js';
export default defineCommand({
  name: 'tags',
  description: 'List popular LessWrong tags.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 20 }],
  output: ['rank', 'name', 'posts'],
  examples: ['panerelay lesswrong tags --limit 10'],
  async run(context, args) {
    const limit = bounded(args.limit, 20);
    const data = await gql(
      context,
      `query Tags { tags(input: {terms: {view: "coreTags", limit: ${limit}}}) { results { _id name slug postCount } } }`,
    );
    const rows = pick(pick(data, 'tags'), 'results');
    if (!Array.isArray(rows) || !rows.length) throw new Error('lesswrong tags returned no results');
    return rows.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      name: text(pick(row, 'name')),
      posts: Number(pick(row, 'postCount')) || 0,
    }));
  },
});
