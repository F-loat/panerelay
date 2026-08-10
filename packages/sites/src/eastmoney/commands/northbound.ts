import { defineCommand } from '@panerelay/site-kit';
import { bounded, EastmoneyClient, pick, text } from '../client.js';
export default defineCommand({
  name: 'northbound',
  description: 'Read Eastmoney northbound or southbound minute capital flows.',
  access: 'read',
  args: [
    { name: 'direction', description: 'north or south.', type: 'string', default: 'north' },
    { name: 'limit', description: 'Maximum minute rows.', type: 'number', default: 10 },
  ],
  output: ['time', 'cumulativeNetYi', 'minuteNetYi', 'totalNetYi'],
  examples: ['panerelay eastmoney northbound --limit 10'],
  async run(context, args) {
    const direction = String(args.direction || 'north').toLowerCase();
    if (!['north', 'south', 'n', 's'].includes(direction))
      throw new Error('eastmoney direction must be north or south');
    const take = bounded(args.limit, 10, 240);
    const url = new URL('https://push2.eastmoney.com/api/qt/kamtbs.rtmin/get');
    url.searchParams.set('fields1', 'f1,f2,f3,f4');
    url.searchParams.set('fields2', 'f51,f52,f54,f56');
    url.searchParams.set('ut', 'b2884a393a59ad64002292a3e90d46a5');
    const raw = pick(
      pick(await new EastmoneyClient(context).json(url), 'data'),
      direction === 'south' || direction === 's' ? 's2n' : 'n2s',
    );
    if (!Array.isArray(raw)) throw new Error('eastmoney northbound returned malformed data');
    const valid = raw
      .map(value => text(value).split(','))
      .filter(values => values.length >= 4 && values[1] !== '-');
    if (!valid.length)
      throw new Error('eastmoney northbound has no valid minute data (market may be closed)');
    return valid.slice(-take).map(([time, cumulative, minute, total]) => ({
      time,
      cumulativeNetYi: Number((Number(cumulative) / 10000).toFixed(4)),
      minuteNetYi: Number((Number(minute) / 10000).toFixed(4)),
      totalNetYi: Number((Number(total) / 10000).toFixed(4)),
    }));
  },
});
