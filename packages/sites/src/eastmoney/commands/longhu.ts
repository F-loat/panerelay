import { defineCommand } from '@panerelay/site-kit';
import { bounded, EastmoneyClient, objectRows, pick, text } from '../client.js';
function defaultDate(): string {
  const value = new Date(Date.now() + 8 * 3600 * 1000);
  value.setUTCDate(value.getUTCDate() - 30);
  return value.toISOString().slice(0, 10);
}
export default defineCommand({
  name: 'longhu',
  description: 'List Eastmoney Dragon and Tiger disclosures.',
  access: 'read',
  args: [
    { name: 'date', description: 'Start date YYYY-MM-DD.', type: 'string', default: '' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: [
    'tradeDate',
    'code',
    'name',
    'closePrice',
    'changeRate',
    'boardAmt',
    'buyAmt',
    'sellAmt',
    'netAmt',
    'turnover',
    'dealRatio',
    'market',
    'reason',
  ],
  examples: ['panerelay eastmoney longhu --limit 10'],
  async run(context, args) {
    const take = bounded(args.limit, 20);
    const since = text(args.date) || defaultDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since))
      throw new Error('eastmoney longhu date must be YYYY-MM-DD');
    const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
    for (const [key, value] of Object.entries({
      sortColumns: 'TRADE_DATE,SECURITY_CODE',
      sortTypes: '-1,1',
      pageSize: String(take),
      pageNumber: '1',
      reportName: 'RPT_DAILYBILLBOARD_DETAILS',
      columns: 'ALL',
      source: 'WEB',
      client: 'WEB',
      filter: `(TRADE_DATE>='${since}')`,
    }))
      url.searchParams.set(key, value);
    return objectRows(
      pick(pick(await new EastmoneyClient(context).json(url), 'result'), 'data'),
      'longhu',
    )
      .slice(0, take)
      .map(item => ({
        tradeDate: text(pick(item, 'TRADE_DATE')).slice(0, 10),
        code: pick(item, 'SECURITY_CODE'),
        name: pick(item, 'SECURITY_NAME_ABBR'),
        closePrice: pick(item, 'CLOSE_PRICE'),
        changeRate: pick(item, 'CHANGE_RATE'),
        boardAmt: pick(item, 'BILLBOARD_DEAL_AMT'),
        buyAmt: pick(item, 'BILLBOARD_BUY_AMT'),
        sellAmt: pick(item, 'BILLBOARD_SELL_AMT'),
        netAmt: pick(item, 'BILLBOARD_NET_AMT'),
        turnover: pick(item, 'ACCUM_AMOUNT'),
        dealRatio: pick(item, 'DEAL_AMOUNT_RATIO'),
        market: pick(item, 'TRADE_MARKET'),
        reason: pick(item, 'EXPLANATION'),
      }));
  },
});
