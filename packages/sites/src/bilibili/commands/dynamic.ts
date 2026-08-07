import { defineCommand } from '@panerelay/site-kit';
import {
  MAX_LIMIT,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  objectValue,
  positiveInteger,
} from '../client.js';
import { dynamicItem } from './_shared/dynamic.js';

export default defineCommand({
  name: 'dynamic',
  description: 'Get the logged-in Bilibili dynamic feed.',
  access: 'read',
  args: [
    {
      name: 'limit',
      description: 'Maximum dynamic items',
      type: 'number',
      default: 15,
    },
  ],
  output: ['id', 'author', 'text', 'likes', 'url'],
  examples: ['panerelay bilibili dynamic'],
  async run(context, args) {
    return commandDynamic(new BilibiliClient(context), args);
  },
});

export async function commandDynamic(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const limit = positiveInteger(args.limit, 'Bilibili dynamic limit', 15, MAX_LIMIT);
  const data = objectValue(await client.data('/x/polymer/web-dynamic/v1/feed/all'), 'dynamic data');
  return arrayValue(data.items ?? [], 'dynamic items')
    .slice(0, limit)
    .map(value => {
      const item = dynamicItem(value);
      return {
        id: item.id,
        author: item.author,
        text: item.text,
        likes: item.likes,
        url: item.url,
      };
    });
}
