import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, required, topicRow, topics } from '../client.js';

export default defineCommand({
  name: 'user-topics',
  description: 'List topics created by a Linux.do user.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Username.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'replies', 'created_at', 'likes', 'views', 'url'],
  examples: ['panerelay linux-do user-topics username --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    return topics(
      await new LinuxDoClient(context).get(
        `/topics/created-by/${encodeURIComponent(required(args.username, 'username'))}.json`,
      ),
    )
      .slice(0, limit)
      .map((topic, index) => {
        const row = topicRow(topic);
        return {
          rank: index + 1,
          title: row.title,
          replies: row.replies,
          created_at: row.created,
          likes: row.likes,
          views: row.views,
          url: row.url,
        };
      });
  },
});
