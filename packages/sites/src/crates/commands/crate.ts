import { defineCommand } from '@panerelay/site-kit';
import { BASE, CratesClient, crateName, pick, text } from '../client.js';

export default defineCommand({
  name: 'crate',
  description: 'Get metadata for one crates.io crate.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'Crates.io crate name',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'name',
    'latestVersion',
    'description',
    'downloads',
    'recentDownloads',
    'versions',
    'license',
    'homepage',
    'documentation',
    'repository',
    'keywords',
    'categories',
    'created',
    'updated',
    'url',
  ],
  examples: ['panerelay crates crate serde'],
  async run(context, args) {
    const name = crateName(args.name);
    const body = (await new CratesClient(context).json(
      `/api/v1/crates/${encodeURIComponent(name)}`,
    )) as { crate?: unknown; versions?: unknown[]; keywords?: unknown[]; categories?: unknown[] };
    const item = body.crate;
    if (!item || !pick(item, 'id')) throw new Error(`No crates.io metadata for "${name}"`);
    const versions = body.versions ?? [];
    const latest =
      versions.find(
        version =>
          pick(version, 'num') ===
          (pick(item, 'newest_version') ?? pick(item, 'max_stable_version')),
      ) ??
      versions[0] ??
      {};
    const names = (values: unknown[] | undefined, key: string) =>
      (values ?? [])
        .map(value => text(pick(value, key) ?? pick(value, 'id')))
        .filter(Boolean)
        .join(', ');
    return [
      {
        name: text(pick(item, 'name') ?? pick(item, 'id')),
        latestVersion: text(
          pick(item, 'newest_version') ??
            pick(item, 'max_stable_version') ??
            pick(item, 'max_version'),
        ),
        description: text(pick(item, 'description')).trim(),
        downloads: pick(item, 'downloads') ?? null,
        recentDownloads: pick(item, 'recent_downloads') ?? null,
        versions: pick(item, 'num_versions') ?? versions.length,
        license: text(pick(latest, 'license')),
        homepage: text(pick(item, 'homepage')),
        documentation: text(pick(item, 'documentation')),
        repository: text(pick(item, 'repository')),
        keywords: names(body.keywords, 'keyword'),
        categories: names(body.categories, 'category'),
        created: text(pick(item, 'created_at')).slice(0, 10),
        updated: text(pick(item, 'updated_at')).slice(0, 10),
        url: `${BASE}/crates/${text(pick(item, 'name') ?? pick(item, 'id'))}`,
      },
    ];
  },
});
