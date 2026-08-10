import { defineCommand } from '@panerelay/site-kit';
import { bounded, numericId, object, pick, PixivClient, workRow } from '../client.js';

export default defineCommand({
  name: 'illusts',
  description: "List a Pixiv artist's illustrations.",
  access: 'read',
  args: [
    {
      name: 'user-id',
      description: 'Pixiv user ID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'illust_id', 'pages', 'bookmarks', 'tags', 'created', 'url'],
  examples: ['panerelay pixiv illusts 123456 --limit 20'],
  async run(context, args) {
    const userId = numericId(args['user-id'], 'user-id');
    const limit = bounded(args.limit, 20, 100);
    const client = new PixivClient(context);
    const profile = object(await client.ajax(`/ajax/user/${userId}/profile/all`));
    const ids = Object.keys(object(pick(profile, 'illusts')))
      .sort((a, b) => Number(b) - Number(a))
      .slice(0, limit);
    const works: Record<string, unknown> = {};
    for (let offset = 0; offset < ids.length; offset += 48) {
      const url = new URL(`/ajax/user/${userId}/profile/illusts`, 'https://www.pixiv.net');
      for (const id of ids.slice(offset, offset + 48)) url.searchParams.append('ids[]', id);
      url.searchParams.set('work_category', 'illustManga');
      url.searchParams.set('is_first_page', offset === 0 ? '1' : '0');
      const body = object(await client.ajax(`${url.pathname}${url.search}`));
      Object.assign(works, object(pick(body, 'works')));
    }
    return ids.flatMap((id, index) => {
      const work = object(works[id]);
      if (!Object.keys(work).length) return [];
      const row = workRow(work, index + 1);
      return [
        {
          rank: row.rank,
          title: row.title,
          illust_id: row.illust_id,
          pages: row.pages,
          bookmarks: row.bookmarks,
          tags: row.tags,
          created: row.created,
          url: row.url,
        },
      ];
    });
  },
});
