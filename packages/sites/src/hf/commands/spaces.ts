import { defineCommand } from '@panerelay/site-kit';
import { HuggingFaceClient, baseRow, bounded, listRows, pick, text } from '../client.js';
export default defineCommand({
  name: 'spaces',
  description: 'List top Hugging Face Spaces.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'likes' },
    { name: 'search', description: 'Optional name filter.', type: 'string' },
    { name: 'sdk', description: 'Optional SDK filter.', type: 'string' },
    { name: 'limit', description: 'Maximum Spaces (1-100).', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'author', 'sdk', 'likes', 'tags', 'lastModified', 'url'],
  examples: ['panerelay hf spaces --limit 5'],
  async run(context, args) {
    const url = new URL('/api/spaces', 'https://huggingface.co');
    url.searchParams.set('sort', text(args.sort || 'likes'));
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(bounded(args.limit, 20)));
    url.searchParams.set('full', 'true');
    if (args.search) url.searchParams.set('search', text(args.search));
    if (args.sdk) url.searchParams.set('sdk', text(args.sdk));
    const rows = listRows(
      await new HuggingFaceClient(context).get(`${url.pathname}${url.search}`),
      'hf spaces',
    );
    return rows.slice(0, bounded(args.limit, 20)).map((row, index) => ({
      ...baseRow(row, index + 1, 'spaces/'),
      sdk: text(pick(row, 'sdk')),
    }));
  },
});
