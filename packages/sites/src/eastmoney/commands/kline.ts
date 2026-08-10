import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, EastmoneyClient, pick, secid, text } from '../client.js';
const PERIOD = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '60m': 60,
  minute: 1,
  hour: 60,
  day: 101,
  daily: 101,
  week: 102,
  weekly: 102,
  month: 103,
  monthly: 103,
};
const ADJUST = {
  none: 0,
  no: 0,
  off: 0,
  forward: 1,
  front: 1,
  pre: 1,
  backward: 2,
  back: 2,
  post: 2,
};
export default defineCommand({
  name: 'kline',
  description: 'Read Eastmoney historical OHLCV data.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Market symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'period', description: 'Kline period.', type: 'string', default: 'day' },
    {
      name: 'adjust',
      description: 'none, forward, or backward.',
      type: 'string',
      default: 'forward',
    },
    { name: 'limit', description: 'Maximum bars.', type: 'number', default: 30 },
  ],
  output: [
    'date',
    'open',
    'close',
    'high',
    'low',
    'volume',
    'turnover',
    'amplitude',
    'changePercent',
    'change',
    'turnoverRate',
  ],
  examples: ['panerelay eastmoney kline 600519 --limit 10'],
  async run(context, args) {
    const period = choice(args.period, 'day', PERIOD, 'period');
    const adjust = choice(args.adjust, 'forward', ADJUST, 'adjust');
    const take = bounded(args.limit, 30, 1000);
    const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
    for (const [key, value] of Object.entries({
      secid: secid(args.symbol),
      klt: String(PERIOD[period as keyof typeof PERIOD]),
      fqt: String(ADJUST[adjust as keyof typeof ADJUST]),
      beg: '0',
      end: '20500101',
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      ut: 'b2884a393a59ad64002292a3e90d46a5',
    }))
      url.searchParams.set(key, value);
    const raw = pick(pick(await new EastmoneyClient(context).json(url), 'data'), 'klines');
    if (!Array.isArray(raw) || !raw.length)
      throw new Error(`eastmoney kline returned no data for ${text(args.symbol)}`);
    return raw.slice(-take).map(value => {
      const [
        date,
        open,
        close,
        high,
        low,
        volume,
        turnover,
        amplitude,
        changePercent,
        change,
        turnoverRate,
      ] = text(value).split(',');
      return {
        date,
        open: Number(open),
        close: Number(close),
        high: Number(high),
        low: Number(low),
        volume: Number(volume),
        turnover: Number(turnover),
        amplitude: Number(amplitude),
        changePercent: Number(changePercent),
        change: Number(change),
        turnoverRate: Number(turnoverRate),
      };
    });
  },
});
