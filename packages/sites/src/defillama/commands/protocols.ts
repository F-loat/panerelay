import { defineCommand } from '@panerelay/site-kit';
import { BASE, date, DefiLlamaClient, limit, pick, text } from '../client.js';
export default defineCommand({
  name: 'protocols',
  description: 'List top DeFi protocols by current TVL.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of protocols', type: 'number', default: 30 }],
  output: [
    'rank',
    'slug',
    'name',
    'category',
    'tvl',
    'mcap',
    'change_1d',
    'change_7d',
    'chains',
    'listedAt',
    'url',
  ],
  examples: ['panerelay defillama protocols --limit 10'],
  async run(context, args) {
    const take = limit(args.limit, 30, 500);
    const body = await new DefiLlamaClient(context).json('/protocols');
    const list = Array.isArray(body)
      ? body
          .filter(item => pick(item, 'slug') || pick(item, 'name'))
          .sort((a, b) => Number(pick(b, 'tvl')) - Number(pick(a, 'tvl')))
          .slice(0, take)
      : [];
    if (!list.length) throw new Error('DefiLlama returned no protocol entries');
    return list.map((item, index) => {
      const protocolSlug = text(pick(item, 'slug'));
      return {
        rank: index + 1,
        slug: protocolSlug,
        name: text(pick(item, 'name')).trim(),
        category: text(pick(item, 'category')).trim(),
        tvl: Number(pick(item, 'tvl')),
        mcap: pick(item, 'mcap') == null ? null : Number(pick(item, 'mcap')),
        change_1d: pick(item, 'change_1d') == null ? null : Number(pick(item, 'change_1d')),
        change_7d: pick(item, 'change_7d') == null ? null : Number(pick(item, 'change_7d')),
        chains: Array.isArray(pick(item, 'chains'))
          ? (pick(item, 'chains') as unknown[]).join(', ')
          : '',
        listedAt: date(pick(item, 'listedAt')),
        url: protocolSlug ? `${BASE}/protocol/${protocolSlug}` : '',
      };
    });
  },
});
