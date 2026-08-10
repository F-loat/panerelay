import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  LinuxDoClient,
  localTime,
  object,
  pick,
  required,
  stripHtml,
  text,
} from '../client.js';

export default defineCommand({
  name: 'user-posts',
  description: 'List posts written by a Linux.do user.',
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
  output: ['index', 'topic_user', 'topic', 'reply', 'time', 'url'],
  examples: ['panerelay linux-do user-posts username --limit 20'],
  async run(context, args) {
    const username = required(args.username, 'username');
    const limit = bounded(args.limit, 20, 100);
    const raw = pick(
      await new LinuxDoClient(context).get(
        `/user_actions.json?username=${encodeURIComponent(username)}&filter=5&offset=0&limit=${limit}`,
      ),
      'user_actions',
    );
    if (!Array.isArray(raw)) throw new Error('linux-do user posts response is malformed');
    return raw.slice(0, limit).map((value, index) => {
      const action = object(value);
      return {
        index: index + 1,
        topic_user: text(pick(action, 'acting_username')) || text(pick(action, 'username')),
        topic: text(pick(action, 'title')),
        reply: stripHtml(pick(action, 'excerpt')).slice(0, 200),
        time: localTime(pick(action, 'created_at')),
        url: `https://linux.do/t/topic/${text(pick(action, 'topic_id'))}/${text(pick(action, 'post_number'))}`,
      };
    });
  },
});
