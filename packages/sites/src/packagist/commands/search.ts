import { defineCommand } from '@panerelay/site-kit';
import { BASE, PackagistClient, boundedLimit, pick, required, text } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search public Packagist packages.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum packages', type: 'number', default: 30 },
  ],
  output: ['rank', 'package', 'description', 'downloads', 'favers', 'repository', 'url'],
  examples: ['panerelay packagist search symfony --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = boundedLimit(args.limit, 30);
    const body = (await new PackagistClient(context).json('/search.json', {
      q: query,
      per_page: take,
    })) as { results?: unknown[] };
    const results = body.results ?? [];
    if (!results.length) throw new Error(`No Packagist packages matched "${query}"`);
    return results.slice(0, take).map((item, index) => ({
      rank: index + 1,
      package: text(pick(item, 'name')),
      description: text(pick(item, 'description')),
      downloads: pick(item, 'downloads') == null ? null : Number(pick(item, 'downloads')),
      favers: pick(item, 'favers') == null ? null : Number(pick(item, 'favers')),
      repository: text(pick(item, 'repository')),
      url: text(pick(item, 'url')) || `${BASE}/packages/${text(pick(item, 'name'))}`,
    }));
  },
});
