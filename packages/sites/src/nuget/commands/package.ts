import { defineCommand } from '@panerelay/site-kit';
import { NugetClient, REGISTRATION_BASE, join, packageId, pick, text } from '../client.js';
export default defineCommand({
  name: 'package',
  description: 'Fetch public NuGet package version history.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'NuGet package id',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'rank',
    'id',
    'version',
    'title',
    'authors',
    'tags',
    'language',
    'licenseExpression',
    'projectUrl',
    'published',
    'listed',
    'url',
  ],
  examples: ['panerelay nuget package Newtonsoft.Json'],
  async run(context, args) {
    const id = packageId(args.id);
    const client = new NugetClient(context);
    const body = (await client.json(
      `${REGISTRATION_BASE}/${encodeURIComponent(id.toLowerCase())}/index.json`,
    )) as { items?: unknown[] };
    const entries: unknown[] = [];
    for (const page of body.items ?? []) {
      const inlineItems = pick(page, 'items');
      let items: unknown[];
      if (Array.isArray(inlineItems)) {
        items = inlineItems;
      } else {
        const pageUrl = text(pick(page, '@id'));
        if (!pageUrl) throw new Error(`NuGet registration page for "${id}" has no @id`);
        items = (pick(await client.json(pageUrl), 'items') as unknown[]) ?? [];
      }
      entries.push(...items);
    }
    if (!entries.length) throw new Error(`No published versions found for "${id}"`);
    entries.sort((left, right) => {
      const published = text(pick(pick(right, 'catalogEntry'), 'published')).localeCompare(
        text(pick(pick(left, 'catalogEntry'), 'published')),
      );
      return (
        published ||
        text(pick(pick(right, 'catalogEntry'), 'version')).localeCompare(
          text(pick(pick(left, 'catalogEntry'), 'version')),
        )
      );
    });
    return entries.map((entry, index) => {
      const item = pick(entry, 'catalogEntry');
      const entryId = text(pick(item, 'id')) || id;
      const version = text(pick(item, 'version'));
      return {
        rank: index + 1,
        id: entryId,
        version: version || null,
        title: pick(item, 'title') ?? null,
        authors: join(pick(item, 'authors')),
        tags: join(pick(item, 'tags')),
        language: pick(item, 'language') ?? null,
        licenseExpression: pick(item, 'licenseExpression') ?? null,
        projectUrl: pick(item, 'projectUrl') ?? null,
        published: pick(item, 'published') ?? null,
        listed: typeof pick(item, 'listed') === 'boolean' ? pick(item, 'listed') : null,
        url: version ? `https://www.nuget.org/packages/${entryId}/${version}` : '',
      };
    });
  },
});
