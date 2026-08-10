import { defineCommand } from '@panerelay/site-kit';
import { NowCoderClient, object, pick } from '../client.js';

export default defineCommand({
  name: 'notifications',
  description: 'Show the unread NowCoder message summary for the logged-in user.',
  access: 'read',
  args: [],
  output: ['type', 'unread'],
  examples: ['panerelay nowcoder notifications'],
  async run(context) {
    const data = object(
      pick(await new NowCoderClient(context).authenticatedGet('message/pc/unread/detail'), 'data'),
    );
    const unread = (key: string) => pick(object(pick(data, key)), 'unreadCount') ?? 0;
    return [
      { type: 'system', unread: unread('systemNotice') },
      { type: 'likes', unread: unread('likeCollect') },
      { type: 'comments', unread: unread('commentMessage') },
      { type: 'follows', unread: unread('followMessage') },
      { type: 'messages', unread: unread('privateMessage') },
      { type: 'job_apply', unread: unread('nowPickJobApply') },
      { type: 'total', unread: unread('total') },
    ];
  },
});
