import { defineCommand } from '@panerelay/site-kit';
import { ChinaRailClient, matchStations, positiveInteger, requiredString } from '../client.js';

export default defineCommand({
  name: 'stations',
  description: 'Search 12306 stations by Chinese name, telecode, or pinyin.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Chinese substring, telecode, or pinyin',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results, up to 50', type: 'number', default: 20 },
  ],
  output: ['name', 'code', 'pinyin', 'abbr', 'city'],
  examples: ['panerelay 12306 stations shanghai'],
  async run(context, args) {
    const keyword = requiredString(args, 'keyword');
    const limit = positiveInteger(args.limit, '12306 station limit', 20, 50);
    const rows = matchStations(await new ChinaRailClient(context).stationBundle(), keyword, limit);
    if (!rows.length) throw new Error(`No 12306 stations match "${keyword}"`);
    return rows.map(({ name, code, pinyin, abbr, city }) => ({ name, code, pinyin, abbr, city }));
  },
});
