import { defineCommand } from '@panerelay/site-kit';
import { escape, gql, list, mapPost, pick, required, text } from './_shared/client.js';
export default defineCommand({
  name: 'tag',
  description: 'List LessWrong posts by tag.',
  access: 'read',
  args: [
    {
      name: 'tag',
      description: 'Tag slug or name.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong tag rationality --limit 5'],
  async run(context, args) {
    const tagName = required(args.tag, 'tag');
    const tagData = await gql(
      context,
      `query TagBySlug { tags(input: {terms: {view: "tagBySlug", slug: "${escape(tagName.toLowerCase().replace(/\s+/g, '-'))}"}}) { results { _id name } } }`,
    );
    const tag = (pick(pick(tagData, 'tags'), 'results') as unknown[] | undefined)?.[0];
    const id = text(pick(tag, '_id'));
    if (!id) throw new Error(`lesswrong tag ${tagName} was not found`);
    const rows = await list(context, 'tagRelevance', args.limit, '', `, tagId: "${escape(id)}"`);
    return rows.map(mapPost);
  },
});
