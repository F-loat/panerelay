import { defineCommand } from '@panerelay/site-kit';
import { ArchiveClient, bounded, required, text } from '../client.js';

function timestamp(value: unknown, label: string): string {
  const result = text(value);
  if (result && !/^\d{4,14}$/.test(result))
    throw new Error(`archive snapshots ${label} must be a digit-only timestamp`);
  return result;
}

export default defineCommand({
  name: 'snapshots',
  description: 'List Wayback Machine snapshots for a URL.',
  access: 'read',
  args: [
    {
      name: 'url',
      description: 'URL to look up',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'from', description: 'Earliest timestamp', type: 'string' },
    { name: 'to', description: 'Latest timestamp', type: 'string' },
    { name: 'limit', description: 'Maximum snapshots', type: 'number', default: 20 },
  ],
  output: ['timestamp', 'snapshotUrl', 'status', 'mimetype', 'originalUrl'],
  examples: ['panerelay archive snapshots wikipedia.org --limit 10'],
  async run(context, args) {
    const target = required(args.url, 'snapshots url');
    const limit = bounded(args.limit, 20, 1000, 'snapshots limit');
    const query = [
      { name: 'url', value: target },
      { name: 'output', value: 'json' },
      { name: 'limit', value: String(limit) },
      ...(timestamp(args.from, 'from')
        ? [{ name: 'from', value: timestamp(args.from, 'from') }]
        : []),
      ...(timestamp(args.to, 'to') ? [{ name: 'to', value: timestamp(args.to, 'to') }] : []),
    ];
    const data = (await new ArchiveClient(context).json(
      'http://web.archive.org/cdx/search/cdx',
      query,
    )) as unknown;
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[0]))
      throw new Error(`No Wayback snapshots for "${target}"`);
    const columns = Object.fromEntries(
      (data[0] as unknown[]).map((name, index) => [text(name), index]),
    );
    for (const name of ['timestamp', 'original', 'statuscode', 'mimetype'])
      if (!Number.isInteger(columns[name]))
        throw new Error(`archive snapshots response is missing "${name}"`);
    return data.slice(1, limit + 1).map(row => {
      if (!Array.isArray(row)) throw new Error('archive snapshots returned a malformed row');
      const value = (name: string) => text(row[columns[name] as number]);
      const stamp = value('timestamp');
      const original = value('original');
      if (!/^\d{14}$/.test(stamp) || !original)
        throw new Error('archive snapshots row is missing timestamp or original URL');
      return {
        timestamp: stamp,
        snapshotUrl: `https://web.archive.org/web/${stamp}/${original}`,
        status: value('statuscode'),
        mimetype: value('mimetype'),
        originalUrl: original,
      };
    });
  },
});
