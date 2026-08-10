import { defineCommand } from '@panerelay/site-kit';
import {
  StackOverflowClient,
  date,
  entities,
  integer,
  items,
  pick,
  required,
  text,
} from '../client.js';
export default defineCommand({
  name: 'user',
  description: 'Find Stack Overflow users by display name.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'Display name or substring.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum users (1-100).', type: 'number', default: 10 },
  ],
  output: [
    'userId',
    'displayName',
    'reputation',
    'goldBadges',
    'silverBadges',
    'bronzeBadges',
    'location',
    'createdAt',
    'lastAccessAt',
    'url',
  ],
  examples: ['panerelay stackoverflow user "Jon Skeet"'],
  async run(context, args) {
    const rows = items(
      await new StackOverflowClient(context).get('/users', {
        inname: required(args.name, 'name'),
        order: 'desc',
        sort: 'reputation',
        pagesize: integer(args.limit, 10, 100),
      }),
      'stackoverflow user',
    );
    return rows.map(item => ({
      userId: pick(item, 'user_id'),
      displayName: entities(pick(item, 'display_name')),
      reputation: Number(pick(item, 'reputation')) || 0,
      goldBadges: Number(pick(pick(item, 'badge_counts'), 'gold')) || 0,
      silverBadges: Number(pick(pick(item, 'badge_counts'), 'silver')) || 0,
      bronzeBadges: Number(pick(pick(item, 'badge_counts'), 'bronze')) || 0,
      location: entities(pick(item, 'location')),
      createdAt: date(pick(item, 'creation_date')),
      lastAccessAt: date(pick(item, 'last_access_date')),
      url: text(pick(item, 'link')),
    }));
  },
});
