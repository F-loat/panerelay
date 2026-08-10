import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, currency, number } from '../client.js';
export default defineCommand({
  name: 'global',
  description: 'Show global crypto market statistics.',
  access: 'read',
  args: [{ name: 'currency', description: 'Quote currency', type: 'string', default: 'usd' }],
  output: [
    'currency',
    'totalMarketCap',
    'totalVolume24h',
    'marketCapChange24hPct',
    'btcDominancePct',
    'ethDominancePct',
    'activeCryptocurrencies',
    'markets',
    'ongoingIcos',
    'updatedAt',
  ],
  examples: ['panerelay coingecko global'],
  async run(context, args) {
    const quote = currency(args.currency);
    const body = (await new CoinGeckoClient(context).json('global')) as Record<string, unknown>;
    const data = body.data as Record<string, unknown> | undefined;
    if (!data) throw new Error('coingecko global returned no data envelope');
    const totalMarketCap = data.total_market_cap as Record<string, unknown> | undefined;
    const totalVolume = data.total_volume as Record<string, unknown> | undefined;
    if (totalMarketCap?.[quote] == null && totalVolume?.[quote] == null)
      throw new Error(`coingecko has no market totals for currency "${quote}"`);
    return [
      {
        currency: quote.toUpperCase(),
        totalMarketCap: number(totalMarketCap?.[quote]),
        totalVolume24h: number(totalVolume?.[quote]),
        marketCapChange24hPct: number(data.market_cap_change_percentage_24h_usd),
        btcDominancePct: number(
          (data.market_cap_percentage as Record<string, unknown> | undefined)?.btc,
        ),
        ethDominancePct: number(
          (data.market_cap_percentage as Record<string, unknown> | undefined)?.eth,
        ),
        activeCryptocurrencies: number(data.active_cryptocurrencies),
        markets: number(data.markets),
        ongoingIcos: number(data.ongoing_icos),
        updatedAt: data.updated_at ? new Date(Number(data.updated_at) * 1000).toISOString() : '',
      },
    ];
  },
});
