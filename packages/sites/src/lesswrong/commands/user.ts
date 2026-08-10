import { defineCommand } from '@panerelay/site-kit';
import { escape, gql, pick, required, strip, text } from './_shared/client.js';
export default defineCommand({
  name: 'user',
  description: 'Read a LessWrong user profile.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'LessWrong username or slug.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay lesswrong user zvi'],
  async run(context, args) {
    const username = required(args.username, 'username').toLowerCase();
    const data = await gql(
      context,
      `query UserProfile { user(input: {selector: {slug: "${escape(username)}"}}) { result { _id displayName slug bio karma postCount commentCount createdAt } } }`,
    );
    const user = pick(pick(data, 'user'), 'result');
    if (!pick(user, '_id')) throw new Error(`lesswrong user ${username} was not found`);
    return [
      { field: 'Name', value: text(pick(user, 'displayName')) },
      { field: 'Username', value: text(pick(user, 'slug')) },
      { field: 'Karma', value: Number(pick(user, 'karma')) || 0 },
      { field: 'Posts', value: Number(pick(user, 'postCount')) || 0 },
      { field: 'Comments', value: Number(pick(user, 'commentCount')) || 0 },
      { field: 'Joined', value: text(pick(user, 'createdAt')) },
      { field: 'Bio', value: strip(pick(user, 'bio')) },
      { field: 'URL', value: `https://www.lesswrong.com/users/${text(pick(user, 'slug'))}` },
    ];
  },
});
