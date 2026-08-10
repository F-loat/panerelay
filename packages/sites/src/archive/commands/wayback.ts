import { defineCommand } from '@panerelay/site-kit';
import { ArchiveClient, required, text } from '../client.js';

function normaliseTimestamp(value: unknown): string {
  const result = text(value).replace(/[^0-9]/g, '');
  if (!/^\d{4,14}$/.test(result) || (result.length !== 4 && result.length % 2 !== 0))
    throw new Error('archive wayback timestamp must be YYYY[MM[DD[hh[mm[ss]]]]]] or an ISO date');
  return result;
}

export default defineCommand({
  name: 'wayback',
  description: 'Look up the closest Wayback Machine snapshot for a URL.',
  access: 'read',
  args: [
    {
      name: 'url',
      description: 'URL to look up',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'timestamp', description: 'Target timestamp', type: 'string' },
  ],
  output: ['originalUrl', 'requestedTimestamp', 'snapshotTimestamp', 'snapshotUrl', 'status'],
  examples: ['panerelay archive wayback wikipedia.org'],
  async run(context, args) {
    const target = required(args.url, 'wayback url');
    const requestedTimestamp = args.timestamp ? normaliseTimestamp(args.timestamp) : '';
    const query = [
      { name: 'url', value: target },
      ...(requestedTimestamp ? [{ name: 'timestamp', value: requestedTimestamp }] : []),
    ];
    const body = (await new ArchiveClient(context).json(
      'https://archive.org/wayback/available',
      query,
    )) as Record<string, unknown>;
    const snapshot = (body.archived_snapshots as Record<string, unknown> | undefined)?.closest as
      Record<string, unknown> | undefined;
    const snapshotTimestamp = text(snapshot?.timestamp);
    const snapshotUrl = text(snapshot?.url);
    if (
      !snapshot ||
      snapshot.available !== true ||
      !snapshotUrl ||
      !/^\d{14}$/.test(snapshotTimestamp)
    )
      throw new Error(`No Wayback snapshot for "${target}"`);
    return [
      {
        originalUrl: text(body.url) || target,
        requestedTimestamp,
        snapshotTimestamp,
        snapshotUrl,
        status: text(snapshot.status),
      },
    ];
  },
});
