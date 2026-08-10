import { defineCommand } from '@panerelay/site-kit';
import { BASE, CratesClient, boundedLimit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search the public crates.io registry by keyword.',
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
  output: [
    'rank',
    'name',
    'latestVersion',
    'description',
    'downloads',
    'recentDownloads',
    'repository',
    'updated',
    'url',
  ],
  examples: ['panerelay crates search serde --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = boundedLimit(args.limit, 20);
    const body = (await new CratesClient(context).json('/api/v1/crates', {
      q: query,
      per_page: take,
    })) as { crates?: unknown[] };
    const rows = body.crates ?? [];
    if (!rows.length) throw new Error(`No crates.io results matched "${query}"`);
    return rows.slice(0, take).map((item, index) => ({
      rank: index + 1,
      name: text(pick(item, 'name') ?? pick(item, 'id')),
      latestVersion: text(
        pick(item, 'newest_version') ??
          pick(item, 'max_stable_version') ??
          pick(item, 'max_version'),
      ),
      description: text(pick(item, 'description')).trim(),
      downloads: pick(item, 'downloads') ?? null,
      recentDownloads: pick(item, 'recent_downloads') ?? null,
      repository: text(pick(item, 'repository') ?? pick(item, 'homepage')),
      updated: text(pick(item, 'updated_at')).slice(0, 10),
      url: pick(item, 'name') ? `${BASE}/crates/${text(pick(item, 'name'))}` : '',
    }));
  },
});
