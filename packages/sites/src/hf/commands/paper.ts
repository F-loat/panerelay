import { defineCommand } from '@panerelay/site-kit';
import { HuggingFaceClient, pick, text } from '../client.js';
export default defineCommand({
  name: 'paper',
  description: 'Read a Hugging Face paper by arXiv id.',
  access: 'read',
  args: [
    { name: 'id', description: 'arXiv id.', type: 'string', required: true, positional: true },
  ],
  output: ['id', 'title', 'authors', 'publishedAt', 'upvotes', 'aiKeywords', 'summary', 'url'],
  examples: ['panerelay hf paper 1706.03762'],
  async run(context, args) {
    const id = text(args.id);
    if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id))
      throw new Error('hf paper id must be a modern arXiv id');
    const body = await new HuggingFaceClient(context).get(`/api/papers/${encodeURIComponent(id)}`);
    if (!body || typeof body !== 'object') throw new Error(`hf paper ${id} returned no data`);
    return [
      {
        id: text(pick(body, 'id')),
        title: text(pick(body, 'title')),
        authors: Array.isArray(pick(body, 'authors'))
          ? (pick(body, 'authors') as unknown[])
              .map(author => text(pick(author, 'name') || pick(author, 'fullname') || author))
              .join(', ')
          : '',
        publishedAt: text(pick(body, 'publishedAt')).slice(0, 10),
        upvotes: Number(pick(body, 'upvotes')) || 0,
        aiKeywords: Array.isArray(pick(body, 'ai_keywords'))
          ? (pick(body, 'ai_keywords') as unknown[]).join(', ')
          : '',
        summary: text(pick(body, 'summary')),
        url: `https://huggingface.co/papers/${id}`,
      },
    ];
  },
});
