import { defineCommand } from '@panerelay/site-kit';
import { bounded, chinaDate, pick, symbol, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'kline',
  description: 'Get historical daily K-line data for a stock.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'days', description: 'Lookback days.', type: 'number', default: 14 },
  ],
  output: ['date', 'open', 'high', 'low', 'close', 'volume'],
  examples: ['panerelay xueqiu kline SH600519 --days 14'],
  async run(context, args) {
    const selected = symbol(args.symbol);
    const days = bounded(args.days, 14, 5_000);
    const payload = await new XueqiuClient(context).get(
      `https://stock.xueqiu.com/v5/stock/chart/kline.json?symbol=${encodeURIComponent(selected)}&begin=${Date.now()}&period=day&type=before&count=-${days}`,
    );
    const data = pick(payload, 'data');
    const columns = Array.isArray(pick(data, 'column'))
      ? (pick(data, 'column') as unknown[]).map(text)
      : [];
    const index = new Map(columns.map((name, position) => [name, position]));
    const items = pick(data, 'item');
    if (!Array.isArray(items)) throw new Error('xueqiu K-line response is malformed');
    return items.map(value => {
      const row = Array.isArray(value) ? value : [];
      const selectedValue = (name: string) => {
        const position = index.get(name);
        return position === undefined ? null : (row[position] ?? null);
      };
      return {
        date: chinaDate(selectedValue('timestamp')),
        open: selectedValue('open'),
        high: selectedValue('high'),
        low: selectedValue('low'),
        close: selectedValue('close'),
        volume: selectedValue('volume'),
      };
    });
  },
});
