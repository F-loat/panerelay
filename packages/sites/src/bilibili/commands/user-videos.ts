import { defineCommand } from '@panerelay/site-kit';
import {
  SITE_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  finiteNumber,
  objectValue,
  optionalString,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';

export default defineCommand({
  name: 'user-videos',
  description: 'List videos submitted by a Bilibili user.',
  access: 'read',
  args: [
    {
      name: 'uid',
      description: 'User UID or username',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'limit',
      description: 'Maximum results, up to 50',
      type: 'number',
      default: 20,
    },
    {
      name: 'order',
      description: 'Sort: pubdate, click, or stow',
      type: 'string',
      default: 'pubdate',
    },
    { name: 'page', description: 'Page number', type: 'number', default: 1 },
  ],
  output: ['rank', 'title', 'plays', 'likes', 'date', 'url'],
  examples: [
    'panerelay fetch bilibili user-videos 2',
    'panerelay fetch bilibili user-videos OpenCLI --order click',
  ],
  async run(context, args) {
    return commandUserVideos(new BilibiliClient(context), args);
  },
});

export async function commandUserVideos(
  client: BilibiliClient,
  args: AdapterArgs,
): Promise<unknown> {
  const uid = await client.resolveUid(requiredString(args, 'uid'));
  const limit = positiveInteger(args.limit, 'Bilibili user-videos limit', 20, 50);
  const page = positiveInteger(args.page, 'Bilibili user-videos page', 1);
  const order = optionalString(args, 'order') ?? 'pubdate';
  if (!['pubdate', 'click', 'stow'].includes(order)) {
    throw new Error('Bilibili user-videos order must be pubdate, click, or stow');
  }
  const data = objectValue(
    await client.data('/x/space/wbi/arc/search', { mid: uid, pn: page, ps: limit, order }, true),
    'user videos data',
  );
  const list = objectValue(data.list, 'user videos list');
  return arrayValue(list.vlist ?? [], 'user videos')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'user video');
      return {
        rank: index + 1,
        title: stringValue(item.title),
        plays: finiteNumber(item.play ?? 0, 'user video plays'),
        likes: finiteNumber(item.like ?? 0, 'user video likes'),
        date: item.created ? new Date(Number(item.created) * 1_000).toISOString().slice(0, 10) : '',
        url: item.bvid ? `${SITE_ORIGIN}/video/${stringValue(item.bvid)}` : '',
      };
    });
}
