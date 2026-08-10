import { defineCommand } from '@panerelay/site-kit';
import {
  commentFullname,
  object,
  pick,
  RedditClient,
  required,
  text,
  writeErrors,
} from '../client.js';

export default defineCommand({
  name: 'reply',
  description: 'Reply to a Reddit comment.',
  access: 'write',
  args: [
    {
      name: 'comment-id',
      description: 'Comment ID, fullname, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'text', description: 'Reply text.', type: 'string', required: true, positional: true },
  ],
  output: ['status', 'message'],
  examples: ['panerelay reddit reply okf3s7u "Thanks"'],
  async run(context, args) {
    const client = new RedditClient(context);
    const fullname = commentFullname(args['comment-id']);
    const result = await client.post(
      '/api/comment',
      {
        parent: fullname,
        text: required(args.text, 'text'),
        api_type: 'json',
        uh: await client.modhash(),
      },
      true,
    );
    const errors = writeErrors(result);
    if (errors) throw new Error(`reddit rejected reply: ${errors}`);
    const things = pick(pick(pick(result, 'json'), 'data'), 'things');
    const created = Array.isArray(things)
      ? things.map(object).find(item => pick(item, 'kind') === 't1')
      : undefined;
    const createdName = created ? text(pick(pick(created, 'data'), 'name')) : '';
    if (!createdName) throw new Error('reddit comment response did not include a created reply ID');
    return [{ status: 'success', message: `Reply posted on ${fullname} as ${createdName}` }];
  },
});
