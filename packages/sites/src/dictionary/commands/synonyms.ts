import { defineCommand } from '@panerelay/site-kit';
import { DictionaryClient, synonyms, pick, word } from '../client.js';

export default defineCommand({
  name: 'synonyms',
  description: 'Find synonyms for a word.',
  access: 'read',
  args: [
    {
      name: 'word',
      description: 'Word to find synonyms for',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['word', 'synonyms'],
  examples: ['panerelay dictionary synonyms serendipity'],
  async run(context, args) {
    const body = await new DictionaryClient(context).lookup(args.word);
    return [{ word: String(pick(body, 'word') || word(args.word)), synonyms: synonyms(body) }];
  },
});
