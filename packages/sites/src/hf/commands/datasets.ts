import { defineCommand } from '@panerelay/site-kit';
import { HuggingFaceClient, baseRow, bounded, listRows, text } from '../client.js';
export default defineCommand({
  name: 'datasets',
  description: 'List top Hugging Face datasets.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'downloads' },
    { name: 'search', description: 'Optional name filter.', type: 'string' },
    { name: 'limit', description: 'Maximum datasets (1-100).', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'author', 'downloads', 'likes', 'tags', 'lastModified', 'url'],
  examples: ['panerelay hf datasets --limit 5'],
  async run(context, args) {
    const url = new URL('/api/datasets', 'https://huggingface.co');
    url.searchParams.set('sort', text(args.sort || 'downloads'));
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(bounded(args.limit, 20)));
    url.searchParams.set('full', 'true');
    if (args.search) url.searchParams.set('search', text(args.search));
    const rows = listRows(
      await new HuggingFaceClient(context).get(`${url.pathname}${url.search}`),
      'hf datasets',
    );
    return rows
      .slice(0, bounded(args.limit, 20))
      .map((row, index) => baseRow(row, index + 1, 'datasets/'));
  },
});
