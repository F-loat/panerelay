import { defineCommand } from '@panerelay/site-kit';
import { pick, required, text, V2exClient } from '../client.js';

export default defineCommand({
  name: 'member',
  description: 'Read a V2EX member profile.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Username.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['username', 'tagline', 'website', 'github', 'twitter', 'location'],
  examples: ['panerelay v2ex member Livid'],
  async run(context, args) {
    const value = await new V2exClient(context).get('members/show.json', {
      username: required(args.username, 'username'),
    });
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('v2ex member returned malformed data');
    return [
      {
        username: text(pick(value, 'username')),
        tagline: text(pick(value, 'tagline')),
        website: text(pick(value, 'website')),
        github: text(pick(value, 'github')),
        twitter: text(pick(value, 'twitter')),
        location: text(pick(value, 'location')),
      },
    ];
  },
});
