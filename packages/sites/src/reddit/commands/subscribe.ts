import { defineCommand } from '@panerelay/site-kit';
import { RedditClient, subredditName } from '../client.js';

export default defineCommand({
  name: 'subscribe',
  description: 'Subscribe or unsubscribe to a subreddit.',
  access: 'write',
  args: [
    {
      name: 'subreddit',
      description: 'Subreddit name.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'undo',
      description: 'Unsubscribe instead of subscribe.',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['status', 'message'],
  examples: ['panerelay reddit subscribe python'],
  async run(context, args) {
    const client = new RedditClient(context);
    const sub = subredditName(args.subreddit);
    await client.post('/api/subscribe', {
      sr_name: sub,
      action: args.undo ? 'unsub' : 'sub',
      uh: await client.modhash(),
    });
    return [
      {
        status: 'success',
        message: `${args.undo ? 'Unsubscribed from' : 'Subscribed to'} r/${sub}`,
      },
    ];
  },
});
