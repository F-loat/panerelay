import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  joinList,
  networkName,
  pick,
  required,
  stripHtml,
  text,
  TvmazeClient,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search TVmaze shows by title.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Show title or fragment',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'id',
    'name',
    'type',
    'language',
    'genres',
    'status',
    'premiered',
    'ended',
    'network',
    'rating',
    'matchScore',
    'summary',
    'url',
  ],
  examples: ['panerelay tvmaze search "breaking bad" --limit 5'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = bounded(args.limit, 20, 50);
    const body = await new TvmazeClient(context).request('/search/shows', [
      { name: 'q', value: query },
    ]);
    if (!Array.isArray(body) || !body.length) throw new Error(`tvmaze no shows matched "${query}"`);
    return body.slice(0, limit).map((entry, index) => {
      const show = pick(entry, 'show');
      const rating = pick(pick(show, 'rating'), 'average');
      return {
        rank: index + 1,
        id: typeof pick(show, 'id') === 'number' ? pick(show, 'id') : null,
        name: text(pick(show, 'name')),
        type: text(pick(show, 'type')),
        language: text(pick(show, 'language')),
        genres: joinList(pick(show, 'genres')),
        status: text(pick(show, 'status')),
        premiered: typeof pick(show, 'premiered') === 'string' ? pick(show, 'premiered') : null,
        ended: typeof pick(show, 'ended') === 'string' ? pick(show, 'ended') : null,
        network: networkName(show),
        rating: rating == null ? null : Number(rating),
        matchScore: typeof pick(entry, 'score') === 'number' ? pick(entry, 'score') : null,
        summary: stripHtml(pick(show, 'summary')),
        url: text(pick(show, 'url')),
      };
    });
  },
});
