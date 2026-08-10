import { defineCommand } from '@panerelay/site-kit';
import { DblpClient, decode, limit, pick, required, text } from '../client.js';

function row(hit: unknown, rank: number) {
  const info = (pick(hit, 'info') ?? {}) as Record<string, unknown>;
  const raw = pick(info, 'authors');
  const values = pick(raw, 'author');
  const authors = (Array.isArray(values) ? values : values ? [values] : [])
    .map(value =>
      text(pick(value, 'text') ?? value)
        .replace(/\s+\d{4,}$/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(', ');
  return {
    rank,
    key: text(pick(info, 'key')),
    title: decode(pick(info, 'title')).replace(/\.\s*$/, ''),
    authors,
    venue: decode(pick(info, 'venue')),
    year: text(pick(info, 'year')),
    type: text(pick(info, 'type')).toLowerCase().split(/\s+/)[0],
    doi: text(pick(info, 'doi')),
    url: text(pick(info, 'ee') ?? pick(info, 'url')),
  };
}
export default defineCommand({
  name: 'search',
  description: 'Search the DBLP computer science bibliography.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'key', 'title', 'authors', 'venue', 'year', 'type', 'doi', 'url'],
  examples: ['panerelay dblp search attention'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = limit(args.limit, 20, 100);
    const body = await new DblpClient(context).json(
      `/search/publ/api?q=${encodeURIComponent(query)}&format=json&h=${take}`,
    );
    const hits = pick(body, 'result.hits.hit');
    const list = Array.isArray(hits) ? hits : hits ? [hits] : [];
    if (!list.length) throw new Error(`No DBLP publications matched "${query}"`);
    return list.slice(0, take).map((hit, index) => row(hit, index + 1));
  },
});
