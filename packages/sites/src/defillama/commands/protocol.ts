import { defineCommand } from '@panerelay/site-kit';
import { BASE, date, DefiLlamaClient, pick, slug, text } from '../client.js';
export default defineCommand({
  name: 'protocol',
  description: 'Get metadata and current TVL for one DeFi protocol.',
  access: 'read',
  args: [
    {
      name: 'slug',
      description: 'DefiLlama protocol slug',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'slug',
    'name',
    'category',
    'isParent',
    'tvl',
    'tvlAt',
    'mcap',
    'chains',
    'twitter',
    'github',
    'audits',
    'listedAt',
    'description',
    'website',
    'url',
  ],
  examples: ['panerelay defillama protocol aave'],
  async run(context, args) {
    const protocolSlug = slug(args.slug);
    const client = new DefiLlamaClient(context);
    const detail = (await client.json(`/protocol/${encodeURIComponent(protocolSlug)}`)) as Record<
      string,
      unknown
    >;
    if (!detail.name) throw new Error(`No DefiLlama metadata for "${protocolSlug}"`);
    const series = Array.isArray(detail.tvl) ? detail.tvl : [];
    const last = series.at(-1);
    const list = (await client.json('/protocols')) as unknown[];
    const match = list.find(item => pick(item, 'slug') === protocolSlug);
    const chains = new Set(Array.isArray(detail.chains) ? detail.chains.map(text) : []);
    if (match && Array.isArray(pick(match, 'chains')))
      for (const chain of pick(match, 'chains') as unknown[]) chains.add(text(chain));
    return [
      {
        slug: protocolSlug,
        name: text(detail.name).trim(),
        category: text(pick(match, 'category')).trim(),
        isParent: detail.isParentProtocol === true,
        tvl:
          last && Number.isFinite(Number(pick(last, 'totalLiquidityUSD')))
            ? Number(pick(last, 'totalLiquidityUSD'))
            : null,
        tvlAt: date(pick(last, 'date')),
        mcap: detail.mcap == null ? null : Number(detail.mcap),
        chains: [...chains].join(', '),
        twitter: text(detail.twitter).trim(),
        github: Array.isArray(detail.github)
          ? detail.github.map(text).join(', ')
          : text(detail.github),
        audits: text(detail.audits).trim(),
        listedAt: date(detail.listedAt),
        description: text(detail.description).trim(),
        website: text(detail.url).trim(),
        url: `${BASE}/protocol/${protocolSlug}`,
      },
    ];
  },
});
