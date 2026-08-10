import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, required, text } from '../client.js';
export default defineCommand({
  name: 'price',
  description: 'Quick price check for a trading pair.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Trading pair symbol',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'symbol',
    'price',
    'change',
    'changePct',
    'high',
    'low',
    'volume',
    'quoteVolume',
    'trades',
  ],
  examples: ['panerelay binance price BTCUSDT'],
  async run(context, args) {
    const symbol = required(args.symbol, 'symbol');
    const row = (await new BinanceClient(context).json('ticker/24hr', [
      { name: 'symbol', value: symbol },
    ])) as Record<string, unknown>;
    return [
      {
        symbol: text(row.symbol),
        price: text(row.lastPrice),
        change: text(row.priceChange),
        changePct: text(row.priceChangePercent),
        high: text(row.highPrice),
        low: text(row.lowPrice),
        volume: text(row.volume),
        quoteVolume: text(row.quoteVolume),
        trades: row.count ?? '',
      },
    ];
  },
});
