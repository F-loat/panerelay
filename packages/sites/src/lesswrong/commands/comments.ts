import { defineCommand } from '@panerelay/site-kit';
import {
  DOMAIN,
  bounded,
  escape,
  gql,
  pick,
  postId,
  required,
  strip,
  text,
} from './_shared/client.js';
export default defineCommand({
  name: 'comments',
  description: 'List top comments on a LessWrong post.',
  access: 'read',
  args: [
    {
      name: 'url-or-id',
      description: 'Post URL or LessWrong post id.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum comments.', type: 'number', default: 5 },
  ],
  output: ['rank', 'score', 'author', 'text'],
  examples: ['panerelay lesswrong comments 5f4c5f4b4f4f4f4f4f4f4f4f'],
  async run(context, args) {
    const id = postId(required(args['url-or-id'], 'post id'));
    const limit = bounded(args.limit, 5);
    const [postData, commentsData] = await Promise.all([
      gql(
        context,
        `query PostTitle { post(input: {selector: {documentId: "${escape(id)}"}}) { result { _id title slug } } }`,
      ),
      gql(
        context,
        `query Comments { comments(input: {terms: {view: "postCommentsTop", postId: "${escape(id)}", limit: ${limit}}}) { results { _id user { displayName } baseScore htmlBody } } }`,
      ),
    ]);
    const post = pick(pick(postData, 'post'), 'result');
    if (!pick(post, '_id')) throw new Error(`lesswrong post ${id} was not found`);
    const rows = pick(pick(commentsData, 'comments'), 'results');
    return [
      {
        rank: '',
        score: '',
        author: '',
        text: `Comments on: ${text(pick(post, 'title'))} (https://${DOMAIN}/posts/${text(pick(post, '_id'))}/${text(pick(post, 'slug'))})`,
      },
      ...(Array.isArray(rows)
        ? rows.slice(0, limit).map((row, index) => ({
            rank: index + 1,
            score: Number(pick(row, 'baseScore')) || 0,
            author: text(pick(pick(row, 'user'), 'displayName')),
            text: strip(pick(row, 'htmlBody')).slice(0, 500),
          }))
        : []),
    ];
  },
});
