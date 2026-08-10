import { defineCommand } from '@panerelay/site-kit';
import { DOMAIN, escape, gql, pick, postId, required, strip, text } from './_shared/client.js';
export default defineCommand({
  name: 'read',
  description: 'Read a LessWrong post by URL or id.',
  access: 'read',
  args: [
    {
      name: 'url-or-id',
      description: 'Post URL or LessWrong post id.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['title', 'author', 'karma', 'comments', 'tags', 'content', 'url'],
  examples: ['panerelay lesswrong read 5f4c5f4b4f4f4f4f4f4f4f4f'],
  async run(context, args) {
    const id = postId(required(args['url-or-id'], 'post id'));
    const data = await gql(
      context,
      `query PostsSingle { post(input: {selector: {documentId: "${escape(id)}"}}) { result { _id title user { displayName } baseScore commentCount htmlBody slug tags { name } } } }`,
    );
    const post = pick(pick(data, 'post'), 'result');
    if (!pick(post, '_id')) throw new Error(`lesswrong post ${id} was not found`);
    const tags = pick(post, 'tags');
    return [
      {
        title: text(pick(post, 'title')),
        author: text(pick(pick(post, 'user'), 'displayName')),
        karma: Number(pick(post, 'baseScore')) || 0,
        comments: Number(pick(post, 'commentCount')) || 0,
        tags: Array.isArray(tags)
          ? tags
              .map(tag => text(pick(tag, 'name')))
              .filter(Boolean)
              .join(', ')
          : '',
        content: strip(pick(post, 'htmlBody')),
        url: `https://${DOMAIN}/posts/${text(pick(post, '_id'))}/${text(pick(post, 'slug'))}`,
      },
    ];
  },
});
