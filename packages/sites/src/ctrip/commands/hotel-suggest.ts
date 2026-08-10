import { defineCommand } from '@panerelay/site-kit';
import { CtripClient, limit, required, row } from '../client.js';
export default defineCommand({
  name: 'hotel-suggest',
  description: 'Search Ctrip cities, business areas, and hotels.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Hotel-context keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum suggestions.', type: 'number', default: 15 },
  ],
  output: [
    'rank',
    'id',
    'type',
    'displayType',
    'name',
    'eName',
    'cityId',
    'cityName',
    'provinceName',
    'countryName',
    'lat',
    'lon',
    'score',
    'url',
  ],
  examples: ['panerelay ctrip hotel-suggest 陆家嘴 --limit 10'],
  async run(context, args) {
    const take = limit(args.limit);
    return (await new CtripClient(context).suggest(required(args.query), 'H'))
      .slice(0, take)
      .map((item, index) => row(item, index + 1))
      .filter(item => item.name);
  },
});
