import { defineCommand } from '@panerelay/site-kit';
import { boundedLimit, OpenFdaClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'food-recall',
  description: 'Search FDA food recall and enforcement actions.',
  access: 'read',
  args: [
    { name: 'query', description: 'Free-text Lucene query', type: 'string' },
    { name: 'status', description: 'Recall status filter', type: 'string' },
    { name: 'classification', description: 'Recall classification filter', type: 'string' },
    { name: 'limit', description: 'Maximum rows', type: 'number', default: 10 },
  ],
  output: [
    'rank',
    'recallNumber',
    'status',
    'classification',
    'voluntary',
    'recallingFirm',
    'city',
    'state',
    'country',
    'productDescription',
    'reasonForRecall',
    'productQuantity',
    'distributionPattern',
    'reportDate',
    'recallInitiationDate',
    'terminationDate',
  ],
  examples: ['panerelay openfda food-recall --classification "Class I" --limit 5'],
  async run(context, args) {
    const limit = boundedLimit(args.limit, 10, 100);
    const filters: string[] = [];
    const query = text(args.query);
    const status = text(args.status);
    const classification = text(args.classification);
    if (query) filters.push(query);
    if (status) filters.push(`status:"${status}"`);
    if (classification) filters.push(`classification:"${classification}"`);
    const requestQuery = filters.length ? [{ name: 'search', value: filters.join(' AND ') }] : [];
    requestQuery.push({ name: 'limit', value: String(limit) });
    const body = await new OpenFdaClient(context).request('/food/enforcement.json', requestQuery);
    const rows = pick(body, 'results');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('openfda no food recall records matched');
    return rows.map((row, index) => ({
      rank: index + 1,
      recallNumber: textOrNull(pick(row, 'recall_number')),
      status: textOrNull(pick(row, 'status')),
      classification: textOrNull(pick(row, 'classification')),
      voluntary: textOrNull(pick(row, 'voluntary_mandated')),
      recallingFirm: textOrNull(pick(row, 'recalling_firm')),
      city: textOrNull(pick(row, 'city')),
      state: textOrNull(pick(row, 'state')),
      country: textOrNull(pick(row, 'country')),
      productDescription: textOrNull(pick(row, 'product_description')),
      reasonForRecall: textOrNull(pick(row, 'reason_for_recall')),
      productQuantity: textOrNull(pick(row, 'product_quantity')),
      distributionPattern: textOrNull(pick(row, 'distribution_pattern')),
      reportDate: textOrNull(pick(row, 'report_date')),
      recallInitiationDate: textOrNull(pick(row, 'recall_initiation_date')),
      terminationDate: textOrNull(pick(row, 'termination_date')),
    }));
  },
});

function textOrNull(value: unknown): string | null {
  const result = text(value);
  return result || null;
}
