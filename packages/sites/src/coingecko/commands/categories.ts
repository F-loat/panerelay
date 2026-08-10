import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, limit, number, text } from '../client.js';
const SORTS = [
  'market_cap_desc',
  'market_cap_asc',
  'name_desc',
  'name_asc',
  'market_cap_change_24h_desc',
  'market_cap_change_24h_asc',
];
export default defineCommand({
  name: 'categories',
  description: 'List crypto categories by market cap.',
  access: 'read',
  args: [
    { name: 'sort', description: 'Sort order', type: 'string', default: 'market_cap_desc' },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'name', 'marketCap', 'volume24h', 'marketCapChange24hPct', 'top3Coins'],
  examples: ['panerelay coingecko categories --limit 10'],
  async run(context, args) {
    const sort = text(args.sort || 'market_cap_desc').toLowerCase();
    if (!SORTS.includes(sort)) throw new Error(`coingecko sort "${args.sort}" is not supported`);
    const rows = await new CoinGeckoClient(context).json('coins/categories', { order: sort });
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('coingecko returned no category data');
    return rows.slice(0, limit(args.limit, 20, 100)).map((row, index) => {
      const category = row as Record<string, unknown>;
      return {
        rank: index + 1,
        id: text(category.id),
        name: text(category.name),
        marketCap: number(category.market_cap),
        volume24h: number(category.volume_24h),
        marketCapChange24hPct: number(category.market_cap_change_24h),
        top3Coins: Array.isArray(category.top_3_coins_id) ? category.top_3_coins_id.join(', ') : '',
      };
    });
  },
});
