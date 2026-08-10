import { defineCommand } from '@panerelay/site-kit';
import { DblpClient, decode, limit, pick, required, text } from '../client.js';
export default defineCommand({
  name: 'venue',
  description: 'Search the DBLP venue registry.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Venue name or acronym',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'acronym', 'venue', 'type', 'url'],
  examples: ['panerelay dblp venue ICLR'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = limit(args.limit, 20, 100);
    const body = await new DblpClient(context).json(
      `/search/venue/api?q=${encodeURIComponent(query)}&format=json&h=${take}`,
    );
    const hits = pick(body, 'result.hits.hit');
    const list = Array.isArray(hits) ? hits : hits ? [hits] : [];
    if (!list.length) throw new Error(`No DBLP venues matched "${query}"`);
    return list.slice(0, take).map((hit, index) => {
      const info = (pick(hit, 'info') ?? {}) as Record<string, unknown>;
      const url = text(info.url);
      return {
        rank: index + 1,
        acronym: text(info.acronym),
        venue: decode(info.venue),
        type: text(info.type).toLowerCase().split(/\s+/)[0],
        url: url.startsWith('http')
          ? url
          : url
            ? `https://dblp.org${url.startsWith('/') ? '' : '/'}${url}`
            : '',
      };
    });
  },
});
