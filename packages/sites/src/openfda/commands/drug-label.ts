import { defineCommand } from '@panerelay/site-kit';
import { boundedLimit, firstOrNull, joinOrNull, OpenFdaClient, pick, required } from '../client.js';

export default defineCommand({
  name: 'drug-label',
  description: 'Search FDA-approved drug labels.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Brand or generic drug name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows', type: 'number', default: 5 },
  ],
  output: [
    'rank',
    'id',
    'brandName',
    'genericName',
    'manufacturer',
    'productType',
    'route',
    'productNdc',
    'pharmClass',
    'purpose',
    'indications',
    'warnings',
    'dosage',
    'effectiveTime',
  ],
  examples: ['panerelay openfda drug-label aspirin --limit 3'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = boundedLimit(args.limit, 5, 25);
    const brand = `openfda.brand_name:"${query}"`;
    const generic = `openfda.generic_name:"${query}"`;
    const body = await new OpenFdaClient(context).request('/drug/label.json', [
      { name: 'search', value: `${brand} OR ${generic}` },
      { name: 'limit', value: String(limit) },
    ]);
    const rows = pick(body, 'results');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`openfda no labels matching "${query}"`);
    return rows.map((row, index) => {
      const openfda = pick(row, 'openfda');
      const pharmClass =
        firstOrNull(pick(openfda, 'pharm_class_epc')) ??
        firstOrNull(pick(openfda, 'pharm_class_moa')) ??
        firstOrNull(pick(openfda, 'pharm_class_cs')) ??
        firstOrNull(pick(openfda, 'pharm_class_pe'));
      return {
        rank: index + 1,
        id: textOrNull(pick(row, 'id')),
        brandName: firstOrNull(pick(openfda, 'brand_name')),
        genericName: firstOrNull(pick(openfda, 'generic_name')),
        manufacturer: firstOrNull(pick(openfda, 'manufacturer_name')),
        productType: firstOrNull(pick(openfda, 'product_type')),
        route: joinOrNull(pick(openfda, 'route')),
        productNdc: firstOrNull(pick(openfda, 'product_ndc')),
        pharmClass,
        purpose: firstOrNull(pick(row, 'purpose')),
        indications: firstOrNull(pick(row, 'indications_and_usage')),
        warnings: firstOrNull(pick(row, 'warnings')),
        dosage: firstOrNull(pick(row, 'dosage_and_administration')),
        effectiveTime: textOrNull(pick(row, 'effective_time')),
      };
    });
  },
});

function textOrNull(value: unknown): string | null {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
}
