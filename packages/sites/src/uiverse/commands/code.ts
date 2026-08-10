import { defineCommand } from '@panerelay/site-kit';
import { code } from '../operations.js';

export default defineCommand({
  name: 'code',
  description: 'Export Uiverse HTML or CSS inline.',
  access: 'read',
  args: [
    {
      name: 'input',
      description: 'Uiverse URL or author/slug.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'target', description: 'html or css.', type: 'string', required: true },
  ],
  output: [
    'target',
    'username',
    'slug',
    'url',
    'language',
    'length',
    'code',
    'post_id',
    'type',
    'is_tailwind',
  ],
  examples: ['panerelay uiverse code cssbuttons-io/fancy-button --target css'],
  async run(context, args) {
    return code(context, args);
  },
});
