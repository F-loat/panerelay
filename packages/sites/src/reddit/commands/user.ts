import { defineCommand } from '@panerelay/site-kit';
import { object, pick, RedditClient, text, username } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'Show a Reddit user profile.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Reddit username.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay reddit user spez'],
  async run(context, args) {
    const name = username(args.username);
    const user = object(
      pick(
        await new RedditClient(context).get(
          `/user/${encodeURIComponent(name)}/about.json?raw_json=1`,
        ),
        'data',
      ),
    );
    const created = Number(pick(user, 'created_utc'));
    const link = Number(pick(user, 'link_karma') ?? 0) || 0;
    const comment = Number(pick(user, 'comment_karma') ?? 0) || 0;
    return [
      { field: 'Username', value: `u/${text(pick(user, 'name')) || name}` },
      { field: 'Post Karma', value: String(link) },
      { field: 'Comment Karma', value: String(comment) },
      { field: 'Total Karma', value: String(Number(pick(user, 'total_karma') ?? link + comment)) },
      {
        field: 'Account Created',
        value: Number.isFinite(created)
          ? new Date(created * 1_000).toISOString().slice(0, 10)
          : '-',
      },
      { field: 'Gold', value: pick(user, 'is_gold') ? '⭐ Yes' : 'No' },
      { field: 'Verified', value: pick(user, 'verified') ? '✅ Yes' : 'No' },
    ];
  },
});
