import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'papers',
  description: 'List NowCoder interview question banks by company and job.',
  access: 'read',
  args: [
    { name: 'job', description: 'Job ID.', type: 'string', default: '11002' },
    { name: 'company', description: 'Optional company ID.', type: 'string', default: '' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'company', 'practitioners'],
  examples: ['panerelay nowcoder papers --job 11002 --company 139 --limit 10'],
  async run(context, args) {
    const jobId = Number(args.job ?? '11002');
    if (!Number.isSafeInteger(jobId) || jobId < 1) throw new Error('nowcoder job must be an ID');
    const company = text(args.company);
    const companyId = company ? Number(company) : undefined;
    if (company && (!Number.isSafeInteger(companyId) || Number(companyId) < 1))
      throw new Error('nowcoder company must be an ID');
    const limit = bounded(args.limit, 10, 100);
    const response = await new NowCoderClient(context).post('company-question/get-paper-list', {
      jobId,
      page: 1,
      pageSize: limit,
      ...(companyId === undefined ? {} : { companyId }),
    });
    const records = pick(pick(response, 'data'), 'records');
    if (!Array.isArray(records)) throw new Error('nowcoder papers response is malformed');
    return records.slice(0, limit).map((value, index) => {
      const paper = object(value);
      return {
        rank: index + 1,
        title: text(pick(paper, 'paperName')),
        company: text(pick(object(pick(paper, 'companyTag')), 'name')),
        practitioners: pick(paper, 'practiceCnt') ?? 0,
      };
    });
  },
});
