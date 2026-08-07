import { defineCommand } from '@panerelay/site-kit';
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

export default defineCommand({
  name: 'history',
  description: "List the current user's Bilibili viewing history.",
  access: 'read',
  args: [
    {
      name: 'limit',
      description: 'Maximum history items',
      type: 'number',
      default: 20,
    },
  ],
  output: ['rank', 'title', 'author', 'progress', 'url'],
  examples: ['panerelay bilibili history'],
  async run(context, args) {
    return commandHistory(new BilibiliClient(context), args);
  },
});

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export async function commandHistory(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const limit = positiveInteger(args.limit, 'Bilibili history limit', 20, MAX_LIMIT);
  const data = objectValue(
    await client.data('/x/web-interface/history/cursor', {
      ps: Math.min(limit, 30),
      type: 'archive',
    }),
    'history data',
  );
  return arrayValue(data.list ?? [], 'history list')
    .slice(0, limit)
    .map((value, index) => {
      const item = objectValue(value, 'history item');
      const progress = finiteNumber(item.progress ?? 0, 'history progress');
      const duration = finiteNumber(item.duration ?? 0, 'history duration');
      const history = isObject(item.history) ? item.history : {};
      return {
        rank: index + 1,
        title: stringValue(item.title),
        author: stringValue(item.author_name),
        progress:
          progress < 0 || progress >= duration
            ? '已看完'
            : `${formatDuration(progress)}/${formatDuration(duration)} (${duration ? Math.round((progress / duration) * 100) : 0}%)`,
        url: history.bvid ? `${SITE_ORIGIN}/video/${stringValue(history.bvid)}` : '',
      };
    });
}
