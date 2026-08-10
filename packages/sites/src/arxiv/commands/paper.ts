import { defineCommand } from '@panerelay/site-kit';
import { ArxivClient, requiredString } from '../client.js';

export default defineCommand({
  name: 'paper',
  description: 'Get arXiv paper details by ID.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'arXiv paper ID, for example 1706.03762',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'id',
    'title',
    'authors',
    'published',
    'updated',
    'primary_category',
    'categories',
    'abstract',
    'comment',
    'pdf',
    'url',
  ],
  examples: ['panerelay arxiv paper 1706.03762'],
  async run(context, args) {
    const id = requiredString(args, 'id');
    const papers = await new ArxivClient(context).query({ id_list: id });
    if (!papers.length) throw new Error(`arXiv paper ${id} was not found`);
    return papers;
  },
});
