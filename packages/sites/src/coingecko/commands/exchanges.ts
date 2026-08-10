import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, limit, number, positive, text } from '../client.js';
export default defineCommand({
  name: 'exchanges',
  description: 'List crypto exchanges by volume.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'page', description: 'One-based page', type: 'number', default: 1 },
  ],
  output: ['rank', 'id', 'name', 'trustScore', 'volume24hBtc', 'country', 'yearEstablished', 'url'],
  examples: ['panerelay coingecko exchanges --limit 10'],
  async run(context, args) {
    const page = positive(args.page, 1, 'page');
    const size = limit(args.limit, 20, 250);
    const rows = await new CoinGeckoClient(context).json('exchanges', { per_page: size, page });
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('coingecko returned no exchange data');
    return rows.map((row, index) => {
      const exchange = row as Record<string, unknown>;
      return {
        rank: (page - 1) * size + index + 1,
        id: text(exchange.id),
        name: text(exchange.name),
        trustScore: number(exchange.trust_score),
        volume24hBtc: number(exchange.trade_volume_24h_btc),
        country: text(exchange.country),
        yearEstablished: number(exchange.year_established),
        url: text(exchange.url),
      };
    });
  },
});
