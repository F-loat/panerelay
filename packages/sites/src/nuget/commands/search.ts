import { defineCommand } from '@panerelay/site-kit';
import { NugetClient, SEARCH_BASE, boundedLimit, join, pick, required, text } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search public NuGet packages.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum packages', type: 'number', default: 20 },
    {
      name: 'prerelease',
      description: 'Include prerelease versions',
      type: 'boolean',
      default: false,
    },
  ],
  output: [
    'rank',
    'id',
    'version',
    'title',
    'description',
    'authors',
    'tags',
    'totalDownloads',
    'verified',
    'projectUrl',
    'url',
  ],
  examples: ['panerelay nuget search newtonsoft --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = boundedLimit(args.limit, 20);
    const body = (await new NugetClient(context).json(`${SEARCH_BASE}/query`, {
      q: query,
      take,
      prerelease: args.prerelease === true ? 'true' : 'false',
    })) as { data?: unknown[] };
    const rows = body.data ?? [];
    if (!rows.length) throw new Error(`No NuGet packages matched "${query}"`);
    return rows.slice(0, take).map((item, index) => {
      const id = text(pick(item, 'id'));
      return {
        rank: index + 1,
        id,
        version: pick(item, 'version') ?? null,
        title: pick(item, 'title') ?? null,
        description: pick(item, 'description') ?? null,
        authors: join(pick(item, 'authors')),
        tags: join(pick(item, 'tags')),
        totalDownloads:
          typeof pick(item, 'totalDownloads') === 'number' ? pick(item, 'totalDownloads') : null,
        verified: pick(item, 'verified') === true,
        projectUrl: pick(item, 'projectUrl') ?? null,
        url: id ? `https://www.nuget.org/packages/${id}` : '',
      };
    });
  },
});
