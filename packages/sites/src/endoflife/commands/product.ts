import { defineCommand } from '@panerelay/site-kit';
import { BASE, EndOfLifeClient, normaliseDateOrFlag, requireProduct, text } from '../client.js';

export default defineCommand({
  name: 'product',
  description: 'List release cycles and support dates for an endoflife.date product.',
  access: 'read',
  args: [
    {
      name: 'product',
      description: 'Product slug',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'product',
    'cycle',
    'releaseDate',
    'latest',
    'latestReleaseDate',
    'lts',
    'support',
    'eol',
    'extendedSupport',
    'eolStatus',
    'url',
  ],
  examples: ['panerelay endoflife product nodejs'],
  async run(context, args) {
    const product = requireProduct(args.product);
    const cycles = await new EndOfLifeClient(context).json(
      `${BASE}/${encodeURIComponent(product)}.json`,
    );
    if (!Array.isArray(cycles) || !cycles.length)
      throw new Error(`endoflife.date returned no cycles for "${product}"`);
    const today = new Date().toISOString().slice(0, 10);
    return cycles.map(cycle => {
      const item = cycle as Record<string, unknown>;
      const eol = normaliseDateOrFlag(item.eol);
      const eolStatus =
        eol === 'ongoing'
          ? 'ongoing'
          : typeof eol === 'string'
            ? eol >= today
              ? 'active'
              : 'eol'
            : null;
      return {
        product,
        cycle: text(item.cycle),
        releaseDate: typeof item.releaseDate === 'string' ? item.releaseDate : null,
        latest: text(item.latest),
        latestReleaseDate:
          typeof item.latestReleaseDate === 'string' ? item.latestReleaseDate : null,
        lts: normaliseDateOrFlag(item.lts),
        support: normaliseDateOrFlag(item.support),
        eol,
        extendedSupport: normaliseDateOrFlag(item.extendedSupport),
        eolStatus,
        url: `https://endoflife.date/${product}`,
      };
    });
  },
});
