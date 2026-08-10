import { defineCommand } from '@panerelay/site-kit';
import { BASE, SteamClient, bounded, pick, price, text } from '../client.js';

export default defineCommand({
  name: 'top-sellers',
  description: 'List Steam top-selling games.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results (1-50).', type: 'number', default: 10 }],
  output: ['rank', 'name', 'price', 'discount', 'url'],
  examples: ['panerelay steam top-sellers --limit 5'],
  async run(context, args) {
    const body = await new SteamClient(context).get(`${BASE}/api/featuredcategories/`);
    const items = pick(pick(body, 'top_sellers'), 'items');
    if (!Array.isArray(items) || items.length === 0)
      throw new Error('steam top sellers returned no results');
    return items.slice(0, bounded(args.limit, 10, 50)).map((item, index) => ({
      rank: index + 1,
      name: text(pick(item, 'name')),
      price: price(pick(item, 'final_price')),
      discount: Number(pick(item, 'discount_percent')) || 0,
      url: `${BASE}/app/${text(pick(item, 'id'))}`,
    }));
  },
});
