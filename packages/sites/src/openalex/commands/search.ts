import { defineCommand } from '@panerelay/site-kit';
import {
  BASE,
  bareDoi,
  bareId,
  bounded,
  number,
  OpenAlexClient,
  required,
  text,
} from '../client.js';
const FIELDS =
  'id,doi,title,publication_year,publication_date,cited_by_count,authorships,primary_location,open_access,type';
export default defineCommand({
  name: 'search',
  description: 'Search OpenAlex works by keyword.',
  access: 'read',
  args: [
    { name: 'query', description: 'Search text', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum works', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'id',
    'title',
    'year',
    'citations',
    'firstAuthor',
    'venue',
    'openAccess',
    'type',
    'doi',
    'url',
  ],
  examples: ['panerelay openalex search transformers --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = bounded(args.limit, 20, 200);
    const body = (await new OpenAlexClient(context).json(`${BASE}/works`, {
      search: query,
      'per-page': limit,
      select: FIELDS,
    })) as Record<string, unknown>;
    const rows = Array.isArray(body.results) ? body.results : [];
    if (!rows.length) throw new Error(`No OpenAlex works matched "${query}"`);
    return rows.slice(0, limit).map((row, index) => {
      const work = row as Record<string, unknown>;
      const authorships = Array.isArray(work.authorships) ? work.authorships : [];
      const firstAuthor = text(
        (
          (authorships[0] as Record<string, unknown> | undefined)?.author as
            Record<string, unknown> | undefined
        )?.display_name,
      );
      const venue = text(
        (
          (work.primary_location as Record<string, unknown> | undefined)?.source as
            Record<string, unknown> | undefined
        )?.display_name,
      );
      const id = bareId(work.id);
      return {
        rank: index + 1,
        id,
        title: text(work.title),
        year: number(work.publication_year),
        citations: number(work.cited_by_count),
        firstAuthor,
        venue,
        openAccess: Boolean((work.open_access as Record<string, unknown> | undefined)?.is_oa),
        type: text(work.type),
        doi: bareDoi(work.doi),
        url: id ? `https://openalex.org/${id}` : '',
      };
    });
  },
});
