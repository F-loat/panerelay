import { defineCommand } from '@panerelay/site-kit';
import { danjuanSnapshot, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'fund-snapshot',
  description: 'Show a Danjuan fund account summary.',
  access: 'read',
  args: [],
  output: ['asOf', 'totalAssetAmount', 'totalFundMarketValue', 'accountCount', 'holdingCount'],
  examples: ['panerelay xueqiu fund-snapshot'],
  async run(context) {
    const snapshot = await danjuanSnapshot(new XueqiuClient(context));
    return [
      {
        asOf: snapshot.asOf,
        totalAssetAmount: snapshot.totalAssetAmount,
        totalFundMarketValue: snapshot.totalFundMarketValue,
        accountCount: snapshot.accounts.length,
        holdingCount: snapshot.holdings.length,
      },
    ];
  },
});
