import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  SiteError,
  inspectSite,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type SiteCommandContext,
} from '@panerelay/site-kit';
import stock from './commands/stock.js';

function bytesResponse(request: BrowserFetchRequest, value: string): BrowserFetchResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/plain; charset=GBK' },
    body: Buffer.from(value, 'ascii').toString('base64'),
    bodyType: 'base64',
    url: request.url,
    redirected: false,
    attachedCookieCount: 0,
  };
}

function context(requests: BrowserFetchRequest[]): SiteCommandContext {
  return {
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'stock-test',
      operation: 'execute',
      command: 'stock',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    async fetch(request) {
      requests.push(request);
      if (request.url.includes('suggest3.sinajs.cn')) {
        return bytesResponse(request, 'var suggestvalue="Apple,41,us,AAPL,Apple";');
      }
      return bytesResponse(
        request,
        'var hq_str_gb_AAPL="Apple,200.50,1.25,x,2.50,x,198.00,197.50,210.00,150.00,12345,x,320000";',
      );
    },
  };
}

test('Sina Finance registers news and stock', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/sinafinance', import.meta.url)));
  assert.deepEqual(value.manifest.commands.map(command => command.name).sort(), ['news', 'stock']);
});

test('stock decodes byte responses and maps a US quote', async () => {
  const requests: BrowserFetchRequest[] = [];
  const rows = await stock.run(context(requests), { key: 'AAPL', market: 'us' });
  assert.deepEqual(rows, [
    {
      Symbol: 'AAPL',
      Name: 'Apple',
      Price: '200.50',
      Change: '2.50',
      ChangePercent: '1.25%',
      Open: '198.00',
      High: '210.00',
      Low: '150.00',
      Volume: '12345',
      MarketCap: '320000',
    },
  ]);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(request => request.responseType === 'base64'));
  assert.ok(requests.every(request => request.withCookies === false));
  assert.match(requests[0]?.url ?? '', /type=41/);
  assert.match(requests[1]?.url ?? '', /list=gb_AAPL/);
});

test('stock rejects an invalid market before fetching', async () => {
  const requests: BrowserFetchRequest[] = [];
  await assert.rejects(
    () => stock.run(context(requests), { key: 'AAPL', market: 'other' }),
    error => error instanceof SiteError && error.code === 'invalid-input',
  );
  assert.equal(requests.length, 0);
});
