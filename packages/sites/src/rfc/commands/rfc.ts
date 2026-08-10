import { defineCommand } from '@panerelay/site-kit';
import { date, pick, required, RfcClient, rfcNumber, text } from '../client.js';

export default defineCommand({
  name: 'rfc',
  description: 'Fetch IETF RFC metadata.',
  access: 'read',
  args: [
    {
      name: 'number',
      description: 'RFC number, optionally prefixed with rfc',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'rfc',
    'title',
    'state',
    'stdLevel',
    'group',
    'groupType',
    'pages',
    'published',
    'authors',
    'abstract',
    'rfcEditorUrl',
    'url',
  ],
  examples: ['panerelay rfc rfc 9000', 'panerelay rfc rfc rfc791'],
  async run(context, args) {
    const number = rfcNumber(required(args.number, 'number'));
    const name = `rfc${number}`;
    const body = await new RfcClient(context).request(number);
    if (!text(pick(body, 'name'))) throw new Error(`rfc ${number} returned no metadata`);
    const authors = pick(body, 'authors');
    return [
      {
        rfc: number,
        title: text(pick(body, 'title')),
        state: text(pick(body, 'state')),
        stdLevel: text(pick(body, 'std_level')),
        group: text(pick(pick(body, 'group'), 'name')),
        groupType: text(pick(pick(body, 'group'), 'type')),
        pages: pick(body, 'pages') == null ? null : Number(pick(body, 'pages')),
        published: date(pick(body, 'time')),
        authors: Array.isArray(authors)
          ? authors
              .map(author => text(pick(author, 'name')))
              .filter(Boolean)
              .join(', ')
          : '',
        abstract: text(pick(body, 'abstract')),
        rfcEditorUrl: `https://www.rfc-editor.org/rfc/rfc${number}`,
        url: `${BASE_URL}/doc/${name}/`,
      },
    ];
  },
});

const BASE_URL = 'https://datatracker.ietf.org';
