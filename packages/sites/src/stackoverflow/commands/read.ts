import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, entities, html, items, pick, required, text } from '../client.js';
export default defineCommand({
  name: 'read',
  description: 'Read a Stack Overflow question.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric question id.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['type', 'author', 'score', 'accepted', 'text'],
  examples: ['panerelay stackoverflow read 79935770'],
  async run(context, args) {
    const id = required(args.id, 'question id');
    if (!/^\d+$/.test(id)) throw new Error('stackoverflow question id must be numeric');
    const question = items(
      await new StackOverflowClient(context).get(`/questions/${id}`, { filter: 'withbody' }),
      'stackoverflow read',
    )[0];
    return [
      {
        type: 'QUESTION',
        author: entities(pick(pick(question, 'owner'), 'display_name')),
        score: Number(pick(question, 'score')) || 0,
        accepted: Boolean(pick(question, 'accepted_answer_id')),
        text: html(pick(question, 'body')) || text(pick(question, 'title')),
      },
    ];
  },
});
