import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'eastmoney',
  name: 'Eastmoney',
  version: '0.8.0',
  origins: [
    'https://data.eastmoney.com',
    'https://datacenter-web.eastmoney.com',
    'https://np-anotice-stock.eastmoney.com',
    'https://np-listapi.eastmoney.com',
    'https://push2.eastmoney.com',
    'https://push2his.eastmoney.com',
  ],
  description: 'Public Eastmoney quotes, rankings, filings, capital flows, and market data.',
});
