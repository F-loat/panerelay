import { defineCommand } from '@panerelay/site-kit';
import { HuggingFaceClient, baseRow, bounded, listRows, pick, text } from '../client.js';
export default defineCommand({
  name: 'models',
  description: 'List top Hugging Face models.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort key.', type: 'string', default: 'downloads' },
    { name: 'search', description: 'Optional name filter.', type: 'string' },
    { name: 'pipeline', description: 'Optional pipeline tag.', type: 'string' },
    { name: 'limit', description: 'Maximum models (1-100).', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'id',
    'author',
    'pipelineTag',
    'downloads',
    'likes',
    'tags',
    'lastModified',
    'url',
  ],
  examples: ['panerelay hf models --limit 5'],
  async run(context, args) {
    const url = new URL('/api/models', 'https://huggingface.co');
    url.searchParams.set('sort', text(args.sort || 'downloads'));
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(bounded(args.limit, 20)));
    url.searchParams.set('full', 'true');
    if (args.search) url.searchParams.set('search', text(args.search));
    if (args.pipeline) url.searchParams.set('pipeline_tag', text(args.pipeline));
    const rows = listRows(
      await new HuggingFaceClient(context).get(`${url.pathname}${url.search}`),
      'hf models',
    );
    return rows.slice(0, bounded(args.limit, 20)).map((row, index) => ({
      ...baseRow(row, index + 1),
      pipelineTag: text(pick(row, 'pipeline_tag') || pick(row, 'pipelineTag')),
    }));
  },
});
