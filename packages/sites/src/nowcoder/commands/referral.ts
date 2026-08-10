import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'referral',
  description: 'List NowCoder internal-referral posts.',
  access: 'read',
  args: [
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: ['rank', 'title', 'author', 'school', 'likes', 'comments', 'views', 'id'],
  examples: ['panerelay nowcoder referral --page 1 --limit 15'],
  async run(context, args) {
    const page = bounded(args.page, 1, 1_000);
    const limit = bounded(args.limit, 15, 100);
    const body = await new NowCoderClient(context).authenticatedGet(
      `home/tab/content?tabId=861&categoryType=1&pageNo=${page}&pageSize=${limit}`,
    );
    const records = pick(pick(body, 'data'), 'records');
    if (!Array.isArray(records)) throw new Error('nowcoder referral response is malformed');
    return records
      .map((value, index) => {
        const item = object(value);
        const content = object(pick(item, 'contentData') ?? pick(item, 'momentData'));
        const user = object(pick(item, 'userBrief'));
        const frequency = object(pick(item, 'frequencyData'));
        return {
          rank: index + 1,
          title: text(pick(content, 'title')),
          author: text(pick(user, 'nickname')),
          school: text(pick(user, 'educationInfo')),
          likes: pick(frequency, 'likeCnt') ?? 0,
          comments: pick(frequency, 'commentCnt') ?? 0,
          views: pick(frequency, 'viewCnt') ?? 0,
          id:
            pick(object(pick(item, 'momentData')), 'uuid') ??
            pick(object(pick(item, 'contentData')), 'uuid') ??
            pick(item, 'contentId') ??
            '',
        };
      })
      .filter(item => item.title)
      .slice(0, limit);
  },
});
