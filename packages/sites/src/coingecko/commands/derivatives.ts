import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, number, positive, text } from '../client.js';
export default defineCommand({
  name: 'derivatives',
  description: 'List crypto derivative markets.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'symbol', description: 'Optional symbol filter', type: 'string' },
  ],
  output: [
    'rank',
    'market',
    'symbol',
    'indexId',
    'contractType',
    'price',
    'change24hPct',
    'fundingRate',
    'openInterestUsd',
    'volume24hUsd',
    'expired',
  ],
  examples: ['panerelay coingecko derivatives --symbol BTC'],
  async run(context, args) {
    const rows = (await new CoinGeckoClient(context).json('derivatives')) as unknown[];
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('coingecko returned no derivative tickers');
    const filter = args.symbol == null ? '' : text(args.symbol).trim().toUpperCase();
    const filtered = filter
      ? rows.filter(row => {
          const item = row as Record<string, unknown>;
          return (
            text(item.symbol).toUpperCase().includes(filter) ||
            text(item.index_id).toUpperCase().includes(filter)
          );
        })
      : rows;
    if (!filtered.length) throw new Error(`No derivative tickers matched symbol="${filter}"`);
    return filtered.slice(0, positive(args.limit, 20, 'derivatives limit')).map((row, index) => {
      const item = row as Record<string, unknown>;
      return {
        rank: index + 1,
        market: text(item.market),
        symbol: text(item.symbol),
        indexId: text(item.index_id),
        contractType: text(item.contract_type),
        price: number(item.price),
        change24hPct: number(item.price_percentage_change_24h),
        fundingRate: number(item.funding_rate),
        openInterestUsd: number(item.open_interest),
        volume24hUsd: number(item.volume_24h),
        expired: text(item.expired_at),
      };
    });
  },
});
