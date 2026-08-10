import { defineCommand } from '@panerelay/site-kit';
import {
  SITE_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  finiteNumber,
  isObject,
  objectValue,
  optionalPositiveInteger,
  positiveInteger,
  stringValue,
} from '../client.js';

export default defineCommand({
  name: 'favorite',
  description: "List videos in one of the current user's favorite folders.",
  access: 'read',
  args: [
    {
      name: 'fid',
      description: 'Favorite folder ID; defaults to the first folder',
      type: 'number',
      positional: true,
    },
    {
      name: 'limit',
      description: 'Number of results, up to 40',
      type: 'number',
      default: 20,
    },
    { name: 'page', description: 'Page number', type: 'number', default: 1 },
  ],
  output: ['rank', 'title', 'author', 'plays', 'url'],
  examples: ['panerelay bilibili favorite', 'panerelay bilibili favorite --fid 123 --page 2'],
  async run(context, args) {
    return commandFavorite(new BilibiliClient(context), args);
  },
});

export async function commandFavorite(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const limit = positiveInteger(args.limit, 'Bilibili favorite limit', 20, 40);
  const page = positiveInteger(args.page, 'Bilibili favorite page', 1);
  let fid = optionalPositiveInteger(args.fid, 'Bilibili favorite folder');
  if (!fid) {
    const uid = await client.selfUid();
    const folders = objectValue(
      await client.data('/x/v3/fav/folder/created/list-all', { up_mid: uid }, true),
      'favorite folders',
    );
    const first = arrayValue(folders.list ?? [], 'favorite folder list')[0];
    if (!first) return [];
    fid = positiveInteger(objectValue(first, 'favorite folder').id, 'Bilibili favorite folder');
  }
  const data = objectValue(
    await client.data('/x/v3/fav/resource/list', { media_id: fid, pn: page, ps: limit }, true),
    'favorite data',
  );
  return arrayValue(data.medias ?? [], 'favorite media')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'favorite item');
      const upper = isObject(item.upper) ? item.upper : {};
      const count = isObject(item.cnt_info) ? item.cnt_info : {};
      return {
        rank: index + 1,
        title: stringValue(item.title),
        author: stringValue(upper.name),
        plays: finiteNumber(count.play ?? 0, 'favorite plays'),
        url: item.bvid ? `${SITE_ORIGIN}/video/${stringValue(item.bvid)}` : '',
      };
    });
}
