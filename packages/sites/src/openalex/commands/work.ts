import { defineCommand } from '@panerelay/site-kit';
import {
  abstract,
  BASE,
  bareDoi,
  bareId,
  OpenAlexClient,
  number,
  text,
  workRef,
} from '../client.js';
const FIELDS =
  'id,doi,title,publication_year,publication_date,cited_by_count,authorships,primary_location,open_access,type,referenced_works,related_works,language,abstract_inverted_index';
export default defineCommand({
  name: 'work',
  description: 'Fetch one OpenAlex work with metadata and abstract.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Work ID, DOI, or URL',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'id',
    'title',
    'type',
    'year',
    'date',
    'language',
    'authors',
    'venue',
    'citations',
    'openAccess',
    'openAccessUrl',
    'referencedCount',
    'doi',
    'abstract',
    'url',
  ],
  examples: ['panerelay openalex work W2741809807'],
  async run(context, args) {
    const ref = workRef(args.id);
    const work = (await new OpenAlexClient(context).json(
      `${BASE}/works/${encodeURIComponent(ref)}`,
      { select: FIELDS },
    )) as Record<string, unknown>;
    const authorships = Array.isArray(work.authorships) ? work.authorships : [];
    const authors = authorships
      .map(item =>
        text(
          ((item as Record<string, unknown>).author as Record<string, unknown> | undefined)
            ?.display_name,
        ),
      )
      .filter(Boolean)
      .join(', ');
    const venue = text(
      (
        (work.primary_location as Record<string, unknown> | undefined)?.source as
          Record<string, unknown> | undefined
      )?.display_name,
    );
    const id = bareId(work.id);
    const access = work.open_access as Record<string, unknown> | undefined;
    return [
      {
        id,
        title: text(work.title),
        type: text(work.type),
        year: number(work.publication_year),
        date: text(work.publication_date),
        language: text(work.language),
        authors,
        venue,
        citations: number(work.cited_by_count),
        openAccess: Boolean(access?.is_oa),
        openAccessUrl: text(access?.oa_url),
        referencedCount: Array.isArray(work.referenced_works) ? work.referenced_works.length : null,
        doi: bareDoi(work.doi),
        abstract: abstract(work.abstract_inverted_index),
        url: id ? `https://openalex.org/${id}` : '',
      },
    ];
  },
});
