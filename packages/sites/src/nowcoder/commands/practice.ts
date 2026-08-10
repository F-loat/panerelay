import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'practice',
  description: 'List categorized NowCoder practice subjects and progress.',
  access: 'read',
  args: [
    { name: 'job', description: 'Career ID.', type: 'string', default: '11226' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['category', 'subject', 'total', 'done', 'remaining'],
  examples: ['panerelay nowcoder practice --job 11226 --limit 20'],
  async run(context, args) {
    const job = text(args.job) || '11226';
    if (!/^\d+$/.test(job)) throw new Error('nowcoder job must be an ID');
    const limit = bounded(args.limit, 20, 100);
    const response = await new NowCoderClient(context).authenticatedGet(
      `intelligent/getPCIntelligentList?jobId=${encodeURIComponent(job)}`,
    );
    const tags = pick(pick(response, 'data'), 'tags');
    if (!Array.isArray(tags)) throw new Error('nowcoder practice response is malformed');
    const rows: Record<string, unknown>[] = [];
    for (const value of tags) {
      const tag = object(value);
      const items = pick(tag, 'items');
      if (!Array.isArray(items)) continue;
      for (const candidate of items) {
        const item = object(candidate);
        rows.push({
          category: text(pick(tag, 'title')) || 'recommended',
          subject: text(pick(item, 'title')),
          total: pick(item, 'tcount') ?? 0,
          done: pick(item, 'rcount') ?? 0,
          remaining: pick(item, 'leftCount') ?? 0,
        });
      }
    }
    return rows.slice(0, limit);
  },
});
