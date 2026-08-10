import { defineCommand } from '@panerelay/site-kit';
import { BASE, SteamClient, appId, country, decode, names, pick, price, text } from '../client.js';

export default defineCommand({
  name: 'app',
  description: 'Fetch Steam storefront details for one app.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric Steam app id.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'currency',
      description: 'Two-letter storefront country code.',
      type: 'string',
      default: 'us',
    },
  ],
  output: [
    'id',
    'name',
    'type',
    'isFree',
    'releaseDate',
    'developers',
    'publishers',
    'price',
    'currency',
    'metacritic',
    'recommendations',
    'genres',
    'categories',
    'shortDescription',
    'website',
    'url',
  ],
  examples: ['panerelay steam app 620'],
  async run(context, args) {
    const id = appId(args.id);
    const body = await new SteamClient(context).get(
      `${BASE}/api/appdetails?appids=${id}&l=en&cc=${country(args.currency)}`,
    );
    const wrapper = pick(body, id);
    const data = pick(wrapper, 'data');
    if (pick(wrapper, 'success') !== true || !data || typeof data !== 'object')
      throw new Error(`steam app ${id} returned no data`);
    const value = data as Record<string, unknown>;
    const free = pick(value, 'is_free') === true;
    const overview = pick(value, 'price_overview');
    return [
      {
        id: text(pick(value, 'steam_appid')) || id,
        name: decode(pick(value, 'name')),
        type: text(pick(value, 'type')),
        isFree: free,
        releaseDate: text(pick(pick(value, 'release_date'), 'date')),
        developers: Array.isArray(pick(value, 'developers'))
          ? (pick(value, 'developers') as unknown[]).join(', ')
          : '',
        publishers: Array.isArray(pick(value, 'publishers'))
          ? (pick(value, 'publishers') as unknown[]).join(', ')
          : '',
        price: free ? 0 : price(pick(overview, 'final')),
        currency: text(pick(overview, 'currency')).toUpperCase(),
        metacritic: Number(pick(pick(value, 'metacritic'), 'score')) || null,
        recommendations: Number(pick(pick(value, 'recommendations'), 'total')) || null,
        genres: names(pick(value, 'genres')),
        categories: names(pick(value, 'categories')),
        shortDescription: decode(pick(value, 'short_description')),
        website: text(pick(value, 'website')),
        url: `${BASE}/app/${text(pick(value, 'steam_appid')) || id}/`,
      },
    ];
  },
});
