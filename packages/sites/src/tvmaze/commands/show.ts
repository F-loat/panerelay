import { defineCommand } from '@panerelay/site-kit';
import { countryName, joinList, pick, showId, stripHtml, text, TvmazeClient } from '../client.js';

export default defineCommand({
  name: 'show',
  description: 'Fetch TVmaze show details by id.',
  access: 'read',
  args: [
    { name: 'id', description: 'TVmaze show id', type: 'number', required: true, positional: true },
  ],
  output: [
    'id',
    'name',
    'type',
    'language',
    'genres',
    'status',
    'premiered',
    'ended',
    'runtime',
    'averageRuntime',
    'network',
    'country',
    'schedule',
    'rating',
    'imdb',
    'thetvdb',
    'officialSite',
    'summary',
    'url',
  ],
  examples: ['panerelay tvmaze show 169'],
  async run(context, args) {
    const id = showId(args.id);
    const show = await new TvmazeClient(context).request(`/shows/${id}`);
    if (pick(show, 'id') == null) throw new Error(`tvmaze no show found for id ${id}`);
    const scheduleValue = pick(show, 'schedule');
    const days = Array.isArray(pick(scheduleValue, 'days'))
      ? joinList(pick(scheduleValue, 'days'))
      : '';
    const time = text(pick(scheduleValue, 'time'));
    return [
      {
        id: Number(pick(show, 'id')),
        name: text(pick(show, 'name')),
        type: text(pick(show, 'type')),
        language: text(pick(show, 'language')),
        genres: joinList(pick(show, 'genres')),
        status: text(pick(show, 'status')),
        premiered: typeof pick(show, 'premiered') === 'string' ? pick(show, 'premiered') : null,
        ended: typeof pick(show, 'ended') === 'string' ? pick(show, 'ended') : null,
        runtime: pick(show, 'runtime') == null ? null : Number(pick(show, 'runtime')),
        averageRuntime:
          pick(show, 'averageRuntime') == null ? null : Number(pick(show, 'averageRuntime')),
        network:
          text(pick(pick(show, 'network'), 'name')) || text(pick(pick(show, 'webChannel'), 'name')),
        country: countryName(show),
        schedule: days || time ? `${days}${days && time ? ' ' : ''}${time}`.trim() : '',
        rating:
          pick(pick(show, 'rating'), 'average') == null
            ? null
            : Number(pick(pick(show, 'rating'), 'average')),
        imdb: text(pick(pick(show, 'externals'), 'imdb')),
        thetvdb:
          pick(pick(show, 'externals'), 'thetvdb') == null
            ? null
            : Number(pick(pick(show, 'externals'), 'thetvdb')),
        officialSite: text(pick(show, 'officialSite')),
        summary: stripHtml(pick(show, 'summary')),
        url: text(pick(show, 'url')),
      },
    ];
  },
});
