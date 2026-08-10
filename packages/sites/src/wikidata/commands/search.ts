import { defineCommand } from '@panerelay/site-kit';
import { bounded, language, pick, required, text, WikidataClient } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Wikidata items by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'language', description: 'Search language', type: 'string', default: 'en' },
    { name: 'limit', description: 'Maximum items', type: 'number', default: 20 },
  ],
  output: ['rank', 'qid', 'label', 'description', 'matchType', 'matchText', 'url'],
  examples: ['panerelay wikidata search einstein --language en --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const lang = language(args.language);
    const limit = bounded(args.limit);
    const body = await new WikidataClient(context).request('/w/api.php', [
      { name: 'action', value: 'wbsearchentities' },
      { name: 'search', value: query },
      { name: 'language', value: lang },
      { name: 'uselang', value: lang },
      { name: 'type', value: 'item' },
      { name: 'format', value: 'json' },
      { name: 'limit', value: String(limit) },
      { name: 'origin', value: '*' },
    ]);
    const rows = pick(body, 'search');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`wikidata no items matched "${query}"`);
    return rows.slice(0, limit).map((item, index) => {
      const qid = text(pick(item, 'id'));
      return {
        rank: index + 1,
        qid,
        label: text(pick(item, 'label')) || null,
        description: text(pick(item, 'description')) || null,
        matchType: text(pick(pick(item, 'match'), 'type')) || null,
        matchText: text(pick(pick(item, 'match'), 'text')) || null,
        url: qid ? `${BASE_URL}/wiki/${qid}` : '',
      };
    });
  },
});

const BASE_URL = 'https://www.wikidata.org';
