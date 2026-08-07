import { defineCommand } from '@panerelay/site-kit';
import {
  MAX_LIMIT,
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
  stripHtml,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Bilibili videos or users.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'type',
      description: 'Result type: video or user',
      type: 'string',
      default: 'video',
    },
    { name: 'page', description: 'Result page', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'score', 'url'],
  examples: [
    'panerelay fetch bilibili search Panerelay',
    'panerelay fetch bilibili search OpenCLI --type user',
  ],
  async run(context, args) {
    return commandSearch(new BilibiliClient(context), args);
  },
});

export async function commandSearch(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const query = requiredString(args, 'query');
  const type = optionalString(args, 'type') ?? 'video';
  if (type !== 'video' && type !== 'user')
    throw new Error('Bilibili search type must be video or user');
  const page = positiveInteger(args.page, 'Bilibili search page', 1);
  const limit = positiveInteger(args.limit, 'Bilibili search limit', 20, MAX_LIMIT);
  const searchType = type === 'user' ? 'bili_user' : 'video';
  const data = objectValue(
    await client.data(
      '/x/web-interface/wbi/search/type',
      { search_type: searchType, keyword: query, page },
      true,
    ),
    'search data',
  );
  return arrayValue(data.result ?? [], 'search result')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'search item');
      return searchType === 'bili_user'
        ? {
            rank: index + 1,
            title: stripHtml(stringValue(item.uname)),
            author: stringValue(item.usign).trim(),
            score: finiteNumber(item.fans ?? 0, 'search fans'),
            url: item.mid ? `https://space.bilibili.com/${stringValue(item.mid)}` : '',
          }
        : {
            rank: index + 1,
            title: stripHtml(stringValue(item.title)),
            author: stringValue(item.author),
            score: finiteNumber(item.play ?? 0, 'search play'),
            url: item.bvid ? `${SITE_ORIGIN}/video/${stringValue(item.bvid)}` : '',
          };
    });
}
