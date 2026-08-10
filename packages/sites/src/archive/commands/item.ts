import { defineCommand } from '@panerelay/site-kit';
import { ARCHIVE_BASE, ArchiveClient, identifier, listText, text } from '../client.js';

export default defineCommand({
  name: 'item',
  description: 'Fetch metadata for one Internet Archive item.',
  access: 'read',
  args: [
    {
      name: 'identifier',
      description: 'Archive item identifier',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'identifier',
    'title',
    'creator',
    'date',
    'mediatype',
    'collection',
    'description',
    'fileCount',
    'url',
  ],
  examples: ['panerelay archive item open-syllabus'],
  async run(context, args) {
    const id = identifier(args.identifier);
    const body = (await new ArchiveClient(context).json(
      `${ARCHIVE_BASE}/metadata/${encodeURIComponent(id)}`,
    )) as Record<string, unknown>;
    const meta = body.metadata as Record<string, unknown> | undefined;
    if (!meta?.identifier) throw new Error(`No public metadata for "${id}" on archive.org`);
    const responseId = text(meta.identifier);
    if (!Array.isArray(body.files))
      throw new Error('archive item returned malformed payload: files must be an array');
    return [
      {
        identifier: responseId,
        title: text(meta.title),
        creator: listText(meta.creator),
        date: text(meta.date).slice(0, 10),
        mediatype: text(meta.mediatype),
        collection: listText(meta.collection),
        description: Array.isArray(meta.description)
          ? meta.description.map(text).join(' ')
          : text(meta.description),
        fileCount: body.files.length,
        url: `https://archive.org/details/${responseId}`,
      },
    ];
  },
});
