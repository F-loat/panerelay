import { defineCommand } from '@panerelay/site-kit';
import { articleId, boundedInt, DevtoClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'read',
  description: 'Read a DEV.to article body by id.',
  access: 'read',
  examples: ['panerelay devto read 123'],
  args: [
    {
      name: 'id',
      description: 'Numeric DEV.to article id',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'max-length', description: 'Maximum body characters', type: 'number', default: 20_000 },
  ],
  output: ['id', 'title', 'author', 'reactions', 'readingTime', 'tags', 'published', 'body', 'url'],
  async run(context, args) {
    const id = articleId(args.id);
    const maxLength = boundedInt(args['max-length'], 20_000, 1_000_000, 'read max-length');
    if (maxLength < 100) throw new Error('devto read max-length must be at least 100');
    const article = await new DevtoClient(context).json(`/articles/${id}`);
    const body = text(pick(article, 'body_markdown'));
    if (!body) throw new Error(`DEV.to article ${id} has no body_markdown`);
    const tagsValue = pick(article, 'tag_list') ?? pick(article, 'tags');
    const tags = Array.isArray(tagsValue) ? tagsValue.map(text).join(', ') : text(tagsValue);
    return [
      {
        id: pick(article, 'id') ?? id,
        title: text(pick(article, 'title')),
        author: text(pick(pick(article, 'user'), 'username')) || '[deleted]',
        reactions: pick(article, 'public_reactions_count') ?? 0,
        readingTime: pick(article, 'reading_time_minutes') ?? 0,
        tags,
        published: text(pick(article, 'published_at')),
        body: body.length > maxLength ? `${body.slice(0, maxLength)}\n\n... [truncated]` : body,
        url: text(pick(article, 'url')),
      },
    ];
  },
});
