import { defineCommand } from '@panerelay/site-kit';
import { DblpClient, recordKey, xmlRow } from '../client.js';
export default defineCommand({
  name: 'paper',
  description: 'Fetch a DBLP record by canonical key.',
  access: 'read',
  args: [
    {
      name: 'key',
      description: 'DBLP record key',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'key',
    'type',
    'title',
    'authors',
    'venue',
    'year',
    'pages',
    'doi',
    'openAccessUrl',
    'dblpUrl',
  ],
  examples: ['panerelay dblp paper conf/nips/VaswaniSPUJGKP17'],
  async run(context, args) {
    const key = recordKey(args.key);
    const row = xmlRow(await new DblpClient(context).xml(`/rec/${encodeURI(key)}.xml`));
    if (!row.key && !row.title) throw new Error(`DBLP returned no record for "${key}"`);
    return [row];
  },
});
