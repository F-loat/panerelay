import { defineCommand } from '@panerelay/site-kit';
import { NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'companies',
  description: 'List hot companies for interview preparation.',
  access: 'read',
  args: [{ name: 'job', description: 'NowCoder job ID.', type: 'string', default: '11002' }],
  output: ['rank', 'company', 'companyId'],
  examples: ['panerelay nowcoder companies --job 11002'],
  async run(context, args) {
    const rows = selected(
      await new NowCoderClient(context).get(
        `company-question/hot-company-list?jobId=${encodeURIComponent(String(args.job || '11002'))}`,
      ),
      'data',
      'result',
    );
    return rows.map((item, index) => ({
      rank: index + 1,
      company: text(pick(item, 'companyName')),
      companyId: pick(item, 'companyId') ?? '',
    }));
  },
});
