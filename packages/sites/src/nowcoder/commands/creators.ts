import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'creators',
  description: 'List top NowCoder content creators.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 }],
  output: ['rank', 'nickname', 'school', 'level', 'heat', 'tag'],
  examples: ['panerelay nowcoder creators --limit 10'],
  async run(context, args) {
    const rows = selected(
      await new NowCoderClient(context).get('content/creator/top-list'),
      'data',
      'result',
    );
    return rows.slice(0, bounded(args.limit, 10)).map((item, index) => ({
      rank: index + 1,
      nickname: text(pick(pick(item, 'userBrief'), 'nickname')),
      school: text(pick(pick(item, 'userBrief'), 'educationInfo')),
      level: text(pick(pick(item, 'userBrief'), 'honorLevelName')),
      heat: pick(item, 'hotValue') ?? 0,
      tag: text(pick(item, 'tag')),
    }));
  },
});
