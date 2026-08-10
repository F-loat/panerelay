import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'salary',
  description: 'List NowCoder salary-disclosure posts.',
  access: 'read',
  args: [
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: ['rank', 'title', 'author', 'school', 'likes', 'comments', 'views', 'id'],
  examples: ['panerelay nowcoder salary --page 1 --limit 15'],
  async run(context, args) {
    const page = bounded(args.page, 1, 1_000);
    const limit = bounded(args.limit, 15, 100);
    const body = await new NowCoderClient(context).authenticatedGet(
      `home/tab/content?tabId=858&categoryType=1&pageNo=${page}&pageSize=${limit}`,
    );
    const records = pick(pick(body, 'data'), 'records');
    if (!Array.isArray(records)) throw new Error('nowcoder salary response is malformed');
    return records
      .map((value, index) => {
        const item = object(value);
        const moment = object(pick(item, 'momentData'));
        const content = object(pick(item, 'contentData'));
        const user = object(pick(item, 'userBrief'));
        const frequency = object(pick(item, 'frequencyData'));
        return {
          rank: index + 1,
          title: text(pick(moment, 'title')) || text(pick(content, 'title')),
          author: text(pick(user, 'nickname')),
          school: text(pick(user, 'educationInfo')),
          likes: pick(frequency, 'likeCnt') ?? 0,
          comments: pick(frequency, 'commentCnt') ?? 0,
          views: pick(frequency, 'viewCnt') ?? 0,
          id: pick(moment, 'uuid') ?? pick(content, 'uuid') ?? pick(item, 'contentId') ?? '',
        };
      })
      .filter(item => item.title)
      .slice(0, limit);
  },
});
