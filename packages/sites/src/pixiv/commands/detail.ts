import { defineCommand } from '@panerelay/site-kit';
import { numericId, object, pick, PixivClient, text } from '../client.js';

export default defineCommand({
  name: 'detail',
  description: 'Show Pixiv illustration details.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Illustration ID.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'illust_id',
    'title',
    'author',
    'type',
    'pages',
    'bookmarks',
    'likes',
    'views',
    'tags',
    'created',
    'url',
  ],
  examples: ['panerelay pixiv detail 123456'],
  async run(context, args) {
    const id = numericId(args.id, 'id');
    const body = object(await new PixivClient(context).ajax(`/ajax/illust/${id}`));
    if (text(pick(body, 'illustId')) !== id || !text(pick(body, 'illustTitle')))
      throw new Error(`pixiv illustration not found: ${id}`);
    const tags = pick(pick(body, 'tags'), 'tags');
    const type = Number(pick(body, 'illustType'));
    return [
      {
        illust_id: id,
        title: text(pick(body, 'illustTitle')),
        author: text(pick(body, 'userName')),
        type: type === 0 ? 'illust' : type === 1 ? 'manga' : type === 2 ? 'ugoira' : String(type),
        pages: pick(body, 'pageCount') ?? 1,
        bookmarks: pick(body, 'bookmarkCount') ?? 0,
        likes: pick(body, 'likeCount') ?? 0,
        views: pick(body, 'viewCount') ?? 0,
        tags: Array.isArray(tags) ? tags.map(item => text(pick(item, 'tag'))).join(', ') : '',
        created: text(pick(body, 'createDate')).split('T')[0] ?? '',
        url: `https://www.pixiv.net/artworks/${id}`,
      },
    ];
  },
});
