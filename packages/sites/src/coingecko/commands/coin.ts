import { defineCommand } from '@panerelay/site-kit';
import { CoinGeckoClient, currency, number, pick, requiredSlug, text } from '../client.js';

export default defineCommand({
  name: 'coin',
  description: 'Fetch a cryptocurrency market detail by CoinGecko id.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'CoinGecko coin id',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'currency', description: 'Quote currency', type: 'string', default: 'usd' },
  ],
  output: [
    'id',
    'symbol',
    'name',
    'rank',
    'price',
    'marketCap',
    'volume24h',
    'change24hPct',
    'change7dPct',
    'change30dPct',
    'ath',
    'athDate',
    'atl',
    'atlDate',
    'circulatingSupply',
    'totalSupply',
    'maxSupply',
    'genesisDate',
    'homepage',
  ],
  examples: ['panerelay coingecko coin bitcoin'],
  async run(context, args) {
    const id = requiredSlug(args.id, 'coin id');
    const quote = currency(args.currency);
    const body = (await new CoinGeckoClient(context).json(`coins/${encodeURIComponent(id)}`, {
      localization: 'false',
      tickers: 'false',
      market_data: 'true',
      community_data: 'false',
      developer_data: 'false',
      sparkline: 'false',
    })) as Record<string, unknown>;
    const market =
      body.market_data && typeof body.market_data === 'object'
        ? (body.market_data as Record<string, unknown>)
        : {};
    const price = pick(market.current_price, quote);
    const marketCap = pick(market.market_cap, quote);
    const volume24h = pick(market.total_volume, quote);
    if (price == null && marketCap == null && volume24h == null)
      throw new Error(`coingecko returned no market data for currency "${quote}"`);
    const date = (value: unknown) => (value ? String(value).slice(0, 10) : '');
    return [
      {
        id: text(body.id) || id,
        symbol: text(body.symbol).toUpperCase(),
        name: text(body.name),
        rank: number(body.market_cap_rank),
        price,
        marketCap,
        volume24h,
        change24hPct: number(market.price_change_percentage_24h),
        change7dPct: number(market.price_change_percentage_7d),
        change30dPct: number(market.price_change_percentage_30d),
        ath: pick(market.ath, quote),
        athDate: date(pick(market.ath_date, quote)),
        atl: pick(market.atl, quote),
        atlDate: date(pick(market.atl_date, quote)),
        circulatingSupply: number(market.circulating_supply),
        totalSupply: number(market.total_supply),
        maxSupply: number(market.max_supply),
        genesisDate: text(body.genesis_date),
        homepage: Array.isArray((body.links as Record<string, unknown> | undefined)?.homepage)
          ? (((body.links as Record<string, unknown>).homepage as unknown[]).find(Boolean) ?? '')
          : '',
      },
    ];
  },
});
