import { defineCommand } from '@panerelay/site-kit';
import { bounded, EastmoneyClient, objectRows, pick, secucode, text } from '../client.js';
export default defineCommand({
  name: 'holders',
  description: 'List Eastmoney top free-float shareholders.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'A-share symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum shareholders.', type: 'number', default: 10 },
  ],
  output: ['rank', 'reportDate', 'name', 'holdNum', 'floatRatio', 'change'],
  examples: ['panerelay eastmoney holders 600519'],
  async run(context, args) {
    const take = bounded(args.limit, 10, 50);
    const code = secucode(args.symbol);
    const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
    for (const [key, value] of Object.entries({
      sortColumns: 'END_DATE,HOLDER_RANK',
      sortTypes: '-1,1',
      pageSize: String(Math.max(take, 10)),
      pageNumber: '1',
      reportName: 'RPT_F10_EH_FREEHOLDERS',
      columns:
        'SECUCODE,SECURITY_CODE,END_DATE,HOLDER_RANK,HOLDER_NAME,HOLD_NUM,FREE_HOLDNUM_RATIO,HOLD_NUM_CHANGE',
      source: 'HSF10',
      client: 'PC',
      filter: `(SECUCODE="${code}")`,
    }))
      url.searchParams.set(key, value);
    const rows = objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'result'), 'data'),
      'holders',
    );
    const latest = text(pick(rows[0], 'END_DATE')).slice(0, 10);
    return rows
      .filter(item => text(pick(item, 'END_DATE')).slice(0, 10) === latest)
      .slice(0, take)
      .map(item => ({
        rank: pick(item, 'HOLDER_RANK'),
        reportDate: latest,
        name: pick(item, 'HOLDER_NAME'),
        holdNum: pick(item, 'HOLD_NUM'),
        floatRatio: pick(item, 'FREE_HOLDNUM_RATIO'),
        change: pick(item, 'HOLD_NUM_CHANGE'),
      }));
  },
});
