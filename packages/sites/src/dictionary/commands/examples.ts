import { defineCommand } from '@panerelay/site-kit';
import { DictionaryClient, example, pick, word } from '../client.js';

export default defineCommand({
  name: 'examples',
  description: 'Read an example sentence for a word.',
  access: 'read',
  args: [
    {
      name: 'word',
      description: 'Word to find an example for',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['word', 'example'],
  examples: ['panerelay dictionary examples serendipity'],
  async run(context, args) {
    const body = await new DictionaryClient(context).lookup(args.word);
    return [{ word: String(pick(body, 'word') || word(args.word)), example: example(body) }];
  },
});
