import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, currency, limit, number, text } from '../client.js';

export default defineCommand({
  name: 'top',
  description: 'List cryptocurrencies by market cap.',
  access: 'read',
  args: [
    { name: 'currency', description: 'Quote currency', type: 'string', default: 'usd' },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 10 },
  ],
  output: [
    'rank',
    'symbol',
    'name',
    'price',
    'change24hPct',
    'marketCap',
    'volume24h',
    'high24h',
    'low24h',
  ],
  examples: ['panerelay coingecko top --limit 10'],
  async run(context, args) {
    const rows = await new CoinGeckoClient(context).json('coins/markets', {
      vs_currency: currency(args.currency),
      order: 'market_cap_desc',
      per_page: limit(args.limit, 10, 250),
      page: 1,
      sparkline: 'false',
    });
    if (!Array.isArray(rows) || !rows.length) throw new Error('coingecko returned no market data');
    return rows.map((row, index) => {
      const coin = row as Record<string, unknown>;
      return {
        rank: number(coin.market_cap_rank) ?? index + 1,
        symbol: text(coin.symbol).toUpperCase(),
        name: text(coin.name),
        price: number(coin.current_price),
        change24hPct: number(coin.price_change_percentage_24h),
        marketCap: number(coin.market_cap),
        volume24h: number(coin.total_volume),
        high24h: number(coin.high_24h),
        low24h: number(coin.low_24h),
      };
    });
  },
});
