import { defineCommand } from '@panerelay/site-kit';
import { LearningClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the logged-in LinkedIn Learning account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'public_id', 'plain_id', 'name'],
  examples: ['panerelay linkedin-learning whoami'],
  async run(context) {
    const data = await new LearningClient(context).get('/voyager/api/me');
    const mini = object(pick(data, 'miniProfile'));
    const publicId = text(pick(mini, 'publicIdentifier'));
    if (!publicId) throw new Error('linkedin-learning session is anonymous');
    const first = text(pick(pick(mini, 'firstName'), 'text') ?? pick(mini, 'firstName'));
    const last = text(pick(pick(mini, 'lastName'), 'text') ?? pick(mini, 'lastName'));
    return [
      {
        logged_in: true,
        site: 'linkedin-learning',
        public_id: publicId,
        plain_id: text(pick(data, 'plainId')),
        name: `${first} ${last}`.trim(),
      },
    ];
  },
});
