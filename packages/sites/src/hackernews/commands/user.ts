import { defineCommand } from '@panerelay/site-kit';
import { HackerNewsClient, isObject, requiredString, stringValue } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'Get a Hacker News user profile.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Hacker News username',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['username', 'karma', 'created', 'about', 'positional'],
  examples: ['panerelay hackernews user pg'],
  async run(context, args) {
    const username = requiredString(args, 'username');
    const item = await new HackerNewsClient(context).get(
      `/user/${encodeURIComponent(username)}.json`,
    );
    if (!isObject(item)) throw new Error(`Hacker News user ${username} was not found`);
    return [
      {
        username: stringValue(item.id),
        karma: item.karma ?? 0,
        created: item.created
          ? new Date(Number(item.created) * 1000).toISOString().slice(0, 10)
          : '',
        about: stringValue(item.about),
      },
    ];
  },
});
