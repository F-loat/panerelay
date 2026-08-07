import type { FetchAdapterCommand } from '@panerelay/protocol';
import {
  MAX_LIMIT,
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

export const commandMetadata = {
  name: 'ranking',
  description: 'Get the Bilibili video ranking board.',
  access: 'read',
  args: [
    {
      name: 'limit',
      description: 'Maximum ranked videos',
      type: 'number',
      default: 20,
    },
  ],
  output: ['rank', 'title', 'author', 'score', 'url'],
  examples: ['panerelay fetch bilibili ranking --limit 20'],
} satisfies FetchAdapterCommand;

export async function commandRanking(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const limit = positiveInteger(args.limit, 'Bilibili ranking limit', 20, MAX_LIMIT);
  const data = objectValue(
    await client.data('/x/web-interface/ranking/v2', { rid: 0, type: 'all' }),
    'ranking data',
  );
  return arrayValue(data.list ?? [], 'ranking list')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'ranking item');
      const owner = isObject(item.owner) ? item.owner : {};
      const stat = isObject(item.stat) ? item.stat : {};
      return {
        rank: index + 1,
        title: stringValue(item.title),
        author: stringValue(owner.name),
        score: finiteNumber(stat.view ?? 0, 'ranking score'),
        url: item.bvid ? `${SITE_ORIGIN}/video/${stringValue(item.bvid)}` : '',
      };
    });
}
