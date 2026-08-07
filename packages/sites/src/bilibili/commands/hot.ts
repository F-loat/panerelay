import { defineCommand } from '@panerelay/site-kit';
import {
  SITE_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  finiteNumber,
  isObject,
  objectValue,
  positiveInteger,
  stringValue,
} from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List popular Bilibili videos.',
  access: 'read',
  args: [
    {
      name: 'limit',
      description: 'Number of videos, up to 50',
      type: 'number',
      default: 20,
    },
  ],
  output: ['rank', 'title', 'author', 'play', 'danmaku', 'bvid', 'url'],
  examples: ['panerelay bilibili hot --limit 10'],
  async run(context, args) {
    return commandHot(new BilibiliClient(context), args);
  },
});

export async function commandHot(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const limit = positiveInteger(args.limit, 'Bilibili hot limit', 20, 50);
  const data = objectValue(
    await client.data('/x/web-interface/popular', { ps: limit, pn: 1 }),
    'popular data',
  );
  return arrayValue(data.list ?? [], 'popular list')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'popular item');
      const owner = isObject(item.owner) ? item.owner : {};
      const stat = isObject(item.stat) ? item.stat : {};
      return {
        rank: index + 1,
        title: stringValue(item.title),
        author: stringValue(owner.name),
        play: finiteNumber(stat.view ?? 0, 'popular play'),
        danmaku: finiteNumber(stat.danmaku ?? 0, 'popular danmaku'),
        bvid: stringValue(item.bvid),
        url: item.bvid ? `${SITE_ORIGIN}/video/${stringValue(item.bvid)}` : '',
      };
    });
}
