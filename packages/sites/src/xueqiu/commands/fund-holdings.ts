import { defineCommand } from '@panerelay/site-kit';
import { danjuanSnapshot, pick, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'fund-holdings',
  description: 'List Danjuan fund holdings, optionally filtered by sub-account.',
  access: 'read',
  args: [{ name: 'account', description: 'Sub-account name or ID.', type: 'string', default: '' }],
  output: [
    'accountName',
    'fdCode',
    'fdName',
    'marketValue',
    'volume',
    'dailyGain',
    'holdGain',
    'holdGainRate',
    'marketPercent',
  ],
  examples: ['panerelay xueqiu fund-holdings --account 主账户'],
  async run(context, args) {
    const snapshot = await danjuanSnapshot(new XueqiuClient(context));
    const filter = text(args.account);
    const holdings = filter
      ? snapshot.holdings.filter(
          item =>
            text(pick(item, 'accountId')) === filter ||
            text(pick(item, 'accountName')).includes(filter),
        )
      : snapshot.holdings;
    if (!holdings.length)
      throw new Error(filter ? `xueqiu no holdings matched ${filter}` : 'xueqiu found no holdings');
    return holdings;
  },
});
