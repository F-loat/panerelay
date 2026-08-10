import { defineCommand } from '@panerelay/site-kit';
import { ArchiveClient, bounded, required, text, listText } from '../client.js';

const SORT_OPTIONS = ['downloads', 'date', 'addeddate', 'week', 'title'];
const SORT_ALIAS: Record<string, string> = { added: 'addeddate', published: 'date' };
const MEDIATYPES = ['texts', 'movies', 'audio', 'software', 'image', 'web', 'data', 'collection'];

export default defineCommand({
  name: 'search',
  description: 'Search Internet Archive items across public media types.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Full-text query',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'mediatype', description: 'Media type filter', type: 'string' },
    { name: 'sort', description: 'Sort key', type: 'string', default: 'downloads' },
    { name: 'limit', description: 'Maximum items', type: 'number', default: 20 },
  ],
  output: ['rank', 'identifier', 'title', 'creator', 'date', 'mediatype', 'downloads', 'url'],
  examples: ['panerelay archive search open source books --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'search query');
    const rawSort = text(args.sort).toLowerCase() || 'downloads';
    const sort = SORT_ALIAS[rawSort] ?? rawSort;
    if (!SORT_OPTIONS.includes(sort))
      throw new Error(`archive search sort must be one of ${SORT_OPTIONS.join(', ')}`);
    const mediatype = text(args.mediatype);
    if (mediatype && !MEDIATYPES.includes(mediatype))
      throw new Error(`archive search mediatype must be one of ${MEDIATYPES.join(', ')}`);
    const limit = bounded(args.limit, 20, 100, 'search limit');
    const fullQuery = mediatype ? `(${query}) AND mediatype:${mediatype}` : query;
    const queryEntries: Array<{ name: string; value: string }> = [
      { name: 'q', value: fullQuery },
      { name: 'output', value: 'json' },
      { name: 'rows', value: String(limit) },
      { name: 'sort[]', value: `${sort} desc` },
      ...['identifier', 'title', 'creator', 'date', 'mediatype', 'downloads'].map(name => ({
        name: 'fl[]',
        value: name,
      })),
    ];
    const body = (await new ArchiveClient(context).json(
      'https://archive.org/advancedsearch.php',
      queryEntries,
    )) as Record<string, unknown>;
    const docs = (body.response as Record<string, unknown> | undefined)?.docs;
    if (!Array.isArray(docs) || docs.length === 0)
      throw new Error(`No Archive items matched "${query}"`);
    return docs.slice(0, limit).map((item, index) => {
      const row = item as Record<string, unknown>;
      const id = text(row.identifier);
      if (!id) throw new Error('archive search returned a result without an identifier');
      const downloads = Number(row.downloads ?? 0);
      if (!Number.isFinite(downloads))
        throw new Error(`archive search returned invalid downloads for "${id}"`);
      return {
        rank: index + 1,
        identifier: id,
        title: text(row.title),
        creator: listText(row.creator),
        date: text(row.date).slice(0, 10),
        mediatype: text(row.mediatype),
        downloads,
        url: `https://archive.org/details/${id}`,
      };
    });
  },
});
