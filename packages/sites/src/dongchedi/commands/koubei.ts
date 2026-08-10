import { defineCommand } from '@panerelay/site-kit';
import {
  DongchediClient,
  limit,
  numericId,
  object,
  pageUrl,
  pick,
  requiredText,
  score,
  seriesId,
  text,
} from '../client.js';

export default defineCommand({
  name: 'koubei',
  description: 'List Dongchedi owner reviews for a car series.',
  access: 'read',
  args: [
    {
      name: 'series-id',
      description: 'Numeric series ID or series URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum reviews.', type: 'number', default: 10 },
  ],
  output: ['rank', 'user', 'car', 'score', 'likes', 'comments', 'content', 'url'],
  examples: ['panerelay dongchedi koubei 649 --limit 10'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const take = limit(args.limit, 10, 15);
    const props = await new DongchediClient(context).pageProps(
      `/auto/series/score/${id}-x-x-x-x-x`,
    );
    const list = pick(object(pick(props, 'reviewListData')), 'review_list');
    if (!Array.isArray(list)) throw new Error('dongchedi reviews returned an unexpected payload');
    const rows = list.slice(0, take).map((item, index) => {
      const review = object(item);
      const purchase = object(pick(review, 'buy_car_info'));
      const year = text(pick(purchase, 'year') ?? pick(review, 'year'));
      const car = text(pick(purchase, 'car_name') ?? pick(review, 'car_name'));
      const content = requiredText(pick(review, 'content'), 'review content');
      const articleId = numericId(
        pick(review, 'gid_str') ?? pick(review, 'gid'),
        `review row ${index + 1}`,
      );
      return {
        rank: index + 1,
        user: requiredText(pick(object(pick(review, 'user_info')), 'name'), 'review user'),
        car: [year, car].filter(Boolean).join(' ') || null,
        score: score(pick(object(pick(review, 'score_info')), 'score')),
        likes: Number(pick(review, 'digg_count_en')) || 0,
        comments: Number(pick(review, 'comment_count_en')) || 0,
        content: content.length > 180 ? `${content.slice(0, 180)}…` : content,
        url: pageUrl(`/ugc/article/${articleId}`),
      };
    });
    if (!rows.length) throw new Error(`dongchedi returned no reviews for series ${id}`);
    return rows;
  },
});
