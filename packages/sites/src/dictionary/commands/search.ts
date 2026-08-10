import { defineCommand } from '@panerelay/site-kit';
import {
  DictionaryClient,
  firstMeaning,
  firstDefinition,
  phonetic,
  pick,
  word,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Fetch a word definition, part of speech, and pronunciation.',
  access: 'read',
  args: [
    {
      name: 'word',
      description: 'Word to define',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['word', 'phonetic', 'type', 'definition'],
  examples: ['panerelay dictionary search serendipity'],
  async run(context, args) {
    const body = await new DictionaryClient(context).lookup(args.word);
    const meaning = firstMeaning(body);
    const definition = firstDefinition(body);
    return [
      {
        word: String(pick(body, 'word') || word(args.word)),
        phonetic: phonetic(body),
        type: String(pick(meaning, 'partOfSpeech') || 'N/A'),
        definition: String(pick(definition, 'definition') || 'No definition found in API.'),
      },
    ];
  },
});
