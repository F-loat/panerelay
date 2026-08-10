import { defineCommand } from '@panerelay/site-kit';
import { TripClient, destination, keyword, limit, pick } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Suggest Trip.com cities and airports for a destination keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Destination keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum suggestions.', type: 'number', default: 20 },
  ],
  output: ['rank', 'name', 'type', 'cityId', 'airportCode', 'province', 'country'],
  examples: ['panerelay trip search Tokyo --limit 10'],
  async run(context, args) {
    const query = keyword(args.query, 'query');
    const take = limit(args.limit);
    const rows = [];
    for (const item of await new TripClient(context).poi(query)) {
      rows.push(item);
      const children = pick(item, 'childResults');
      if (Array.isArray(children))
        rows.push(...children.filter(child => child && typeof child === 'object'));
    }
    const result = rows
      .map((item, index) => destination(item as Record<string, unknown>, index + 1))
      .filter(item => item.name)
      .slice(0, take);
    if (!result.length) throw new Error(`trip returned no destinations for "${query}"`);
    return result;
  },
});
