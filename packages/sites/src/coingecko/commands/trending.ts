import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, number, text } from '../client.js';

export default defineCommand({
  name: 'trending',
  description: 'List trending cryptocurrencies.',
  access: 'read',
  args: [],
  output: ['rank', 'id', 'symbol', 'name', 'marketCapRank', 'priceBtc', 'thumb'],
  examples: ['panerelay coingecko trending'],
  async run(context) {
    const body = (await new CoinGeckoClient(context).json('search/trending')) as Record<
      string,
      unknown
    >;
    const rows = Array.isArray(body.coins) ? body.coins : [];
    if (!rows.length) throw new Error('coingecko returned no trending coins');
    return rows.map((entry, index) => {
      const coin = ((entry as Record<string, unknown>).item as Record<string, unknown>) ?? {};
      return {
        rank: index + 1,
        id: text(coin.id),
        symbol: text(coin.symbol).toUpperCase(),
        name: text(coin.name),
        marketCapRank: number(coin.market_cap_rank),
        priceBtc: number(coin.price_btc),
        thumb: text(coin.thumb || coin.small || coin.large),
      };
    });
  },
});
