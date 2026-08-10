import { defineCommand } from '@panerelay/site-kit';
import { BASE, SteamClient, bounded, country, decode, pick, price, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search the Steam storefront.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results (1-50).', type: 'number', default: 20 },
    {
      name: 'currency',
      description: 'Two-letter storefront country code.',
      type: 'string',
      default: 'us',
    },
  ],
  output: ['rank', 'id', 'name', 'price', 'currency', 'metascore', 'platforms', 'url'],
  examples: ['panerelay steam search portal --limit 5'],
  async run(context, args) {
    const query = text(args.query);
    if (!query) throw new Error('steam query cannot be empty');
    const body = await new SteamClient(context).get(
      `${BASE}/api/storesearch/?term=${encodeURIComponent(query)}&l=en&cc=${country(args.currency)}`,
    );
    const items = pick(body, 'items');
    if (!Array.isArray(items) || items.length === 0)
      throw new Error(`steam search returned no results for "${query}"`);
    const limit = bounded(args.limit, 20, 50);
    return items.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      id: text(pick(item, 'id')),
      name: decode(pick(item, 'name')),
      price: price(pick(pick(item, 'price'), 'final')),
      currency: text(pick(pick(item, 'price'), 'currency')).toUpperCase(),
      metascore: Number(pick(item, 'metascore')) || null,
      platforms: Object.entries((pick(item, 'platforms') || {}) as Record<string, unknown>)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(','),
      url: `${BASE}/app/${text(pick(item, 'id'))}/`,
    }));
  },
});
