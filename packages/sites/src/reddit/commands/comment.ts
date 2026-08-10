import { defineCommand } from '@panerelay/site-kit';
import {
  object,
  pick,
  postFullname,
  RedditClient,
  required,
  text,
  writeErrors,
} from '../client.js';

export default defineCommand({
  name: 'comment',
  description: 'Post a comment on a Reddit post.',
  access: 'write',
  args: [
    {
      name: 'post-id',
      description: 'Post ID, fullname, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'text',
      description: 'Comment text.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['status', 'message'],
  examples: ['panerelay reddit comment 1abc123 "Thanks"'],
  async run(context, args) {
    const client = new RedditClient(context);
    const fullname = postFullname(args['post-id']);
    const body = required(args.text, 'text');
    const result = await client.post(
      '/api/comment',
      { parent: fullname, text: body, api_type: 'json', uh: await client.modhash() },
      true,
    );
    const errors = writeErrors(result);
    if (errors) throw new Error(`reddit rejected comment: ${errors}`);
    const things = pick(pick(pick(result, 'json'), 'data'), 'things');
    const created = Array.isArray(things)
      ? things.map(object).find(item => pick(item, 'kind') === 't1')
      : undefined;
    return [
      {
        status: 'success',
        message: `Comment posted on ${fullname}${created ? ` as ${text(pick(pick(created, 'data'), 'name'))}` : ''}`,
      },
    ];
  },
});
