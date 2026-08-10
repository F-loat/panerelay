import { defineCommand } from '@panerelay/site-kit';
import { escape, gql, pick, postUrl, required, text, bounded } from './_shared/client.js';
export default defineCommand({
  name: 'user-posts',
  description: "List a LessWrong user's posts.",
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'LessWrong username or slug.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'karma', 'comments', 'date', 'url'],
  examples: ['panerelay lesswrong user-posts zvi --limit 5'],
  async run(context, args) {
    const username = required(args.username, 'username').toLowerCase();
    const userData = await gql(
      context,
      `query UserProfile { user(input: {selector: {slug: "${escape(username)}"}}) { result { _id } } }`,
    );
    const id = text(
      pick(pick(userData, 'user'), 'result') && pick(pick(pick(userData, 'user'), 'result'), '_id'),
    );
    if (!id) throw new Error(`lesswrong user ${username} was not found`);
    const limit = bounded(args.limit, 10);
    const data = await gql(
      context,
      `query UserPosts { posts(input: {terms: {view: "userPosts", userId: "${escape(id)}", limit: ${limit}}}) { results { _id title baseScore commentCount slug postedAt } } }`,
    );
    const rows = pick(pick(data, 'posts'), 'results');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`lesswrong user ${username} returned no posts`);
    return rows.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      title: text(pick(row, 'title')),
      karma: Number(pick(row, 'baseScore')) || 0,
      comments: Number(pick(row, 'commentCount')) || 0,
      date: text(pick(row, 'postedAt')),
      url: postUrl(row as Record<string, unknown>),
    }));
  },
});
