import { defineCommand } from '@panerelay/site-kit';
import { bounded, groups, object, pick, text, ZsxqClient } from '../client.js';

export default defineCommand({
  name: 'groups',
  description: 'List ZSXQ groups joined by the logged-in account.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 50 }],
  output: ['group_id', 'name', 'category', 'members', 'topics', 'joined_at', 'url'],
  examples: ['panerelay zsxq groups --limit 50'],
  async run(context, args) {
    const limit = bounded(args.limit, 50, 100);
    return groups(await new ZsxqClient(context).get('/v2/groups'))
      .slice(0, limit)
      .map(group => ({
        group_id: pick(group, 'group_id') ?? '',
        name: text(pick(group, 'name')),
        category: text(pick(object(pick(group, 'category')), 'title')),
        members: pick(object(pick(group, 'statistics')), 'subscriptions_count') ?? 0,
        topics: pick(object(pick(group, 'statistics')), 'topics_count') ?? 0,
        joined_at: text(pick(object(pick(group, 'user_specific')), 'join_time')),
        url: pick(group, 'group_id')
          ? `https://wx.zsxq.com/group/${text(pick(group, 'group_id'))}`
          : 'https://wx.zsxq.com',
      }));
  },
});
