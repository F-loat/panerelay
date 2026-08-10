import { defineCommand } from '@panerelay/site-kit';
import { HuggingFaceClient, bounded, listRows, pick, text } from '../client.js';
export default defineCommand({
  name: 'top',
  description: 'List top Hugging Face daily papers.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum papers (1-100).', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'upvotes', 'authors'],
  examples: ['panerelay hf top --limit 5'],
  async run(context, args) {
    const rows = listRows(await new HuggingFaceClient(context).get('/api/daily_papers'), 'hf top');
    return rows.slice(0, bounded(args.limit, 20)).map((row, index) => {
      const paper = pick(row, 'paper') || row;
      return {
        rank: index + 1,
        id: text(pick(paper, 'id')),
        title: text(pick(row, 'title') || pick(paper, 'title')),
        upvotes: Number(pick(paper, 'upvotes')) || 0,
        authors: Array.isArray(pick(paper, 'authors'))
          ? (pick(paper, 'authors') as unknown[])
              .map(author => text(pick(author, 'name') || author))
              .join(', ')
          : '',
      };
    });
  },
});
