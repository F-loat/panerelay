import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'recommend',
  description: 'List the NowCoder recommended feed.',
  access: 'read',
  args: [
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: ['rank', 'title', 'author', 'likes', 'comments', 'views', 'id'],
  examples: ['panerelay nowcoder recommend --limit 10'],
  async run(context, args) {
    const page = bounded(args.page, 1, 10000);
    const take = bounded(args.limit, 15);
    const rows = selected(
      await new NowCoderClient(context).get(`home/recommend?page=${page}&size=${take}`),
      'data',
      'records',
    );
    return rows
      .map(item => {
        const content =
          pick(item, 'momentData') || pick(item, 'longContentData') || pick(item, 'contentData');
        return {
          rank: 0,
          title: text(pick(content, 'title')),
          author: text(pick(pick(item, 'userBrief'), 'nickname')),
          likes: pick(pick(item, 'frequencyData'), 'likeCnt') ?? 0,
          comments: pick(pick(item, 'frequencyData'), 'commentCnt') ?? 0,
          views: pick(pick(item, 'frequencyData'), 'viewCnt') ?? 0,
          id: pick(content, 'uuid') ?? pick(item, 'contentId') ?? '',
        };
      })
      .filter(row => row.title)
      .slice(0, take)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  },
});
