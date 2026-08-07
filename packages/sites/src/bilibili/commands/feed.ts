import { defineCommand } from '@panerelay/site-kit';
import {
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  isObject,
  objectValue,
  optionalString,
  positiveInteger,
  stringValue,
} from '../client.js';
import { dynamicItem } from './_shared/dynamic.js';

export default defineCommand({
  name: 'feed',
  description: "Read the followed timeline or one user's dynamic feed.",
  access: 'read',
  args: [
    {
      name: 'uid',
      description: 'Optional user UID or username',
      type: 'string',
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    {
      name: 'type',
      description: 'Filter: all, video, article, draw, or text',
      type: 'string',
      default: 'all',
    },
    { name: 'pages', description: 'Number of API pages', type: 'number', default: 1 },
  ],
  output: ['rank', 'time', 'author', 'title', 'type', 'likes', 'url'],
  examples: ['panerelay bilibili feed', 'panerelay bilibili feed 2 --type video --pages 2'],
  async run(context, args) {
    return commandFeed(new BilibiliClient(context), args);
  },
});

export async function commandFeed(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const uidInput = optionalString(args, 'uid');
  const limit = positiveInteger(args.limit, 'Bilibili feed limit', 20, 500);
  const pages = positiveInteger(args.pages, 'Bilibili feed pages', 1, 25);
  const filter = optionalString(args, 'type') ?? 'all';
  if (!['all', 'video', 'article', 'draw', 'text'].includes(filter)) {
    throw new Error('Bilibili feed type must be all, video, article, draw, or text');
  }
  const uid = uidInput ? await client.resolveUid(uidInput) : undefined;
  const rows: unknown[] = [];
  let offset = '';
  for (let page = 1; page <= pages && rows.length < limit; page += 1) {
    const data = objectValue(
      uid
        ? await client.data('/x/polymer/web-dynamic/v1/feed/space', {
            host_mid: uid,
            timezone_offset: -480,
            ...(offset ? { offset } : {}),
          })
        : await client.data('/x/polymer/web-dynamic/v1/feed/all', {
            timezone_offset: -480,
            type: filter,
            page,
            ...(offset ? { offset } : {}),
          }),
      'feed data',
    );
    const items = arrayValue(data.items ?? [], 'feed items');
    for (const value of items) {
      const item = dynamicItem(value);
      if (filter !== 'all' && item.type !== filter) continue;
      rows.push({
        rank: rows.length + 1,
        time: item.time,
        author: item.author,
        title: item.text,
        type: item.type,
        likes: item.likes,
        url: item.url,
      });
      if (rows.length >= limit) break;
    }
    if (items.length === 0) break;
    const tail = items.at(-1);
    offset = stringValue(data.offset || (isObject(tail) ? tail.id_str : ''));
    if (!offset || !data.has_more) break;
  }
  return rows;
}
