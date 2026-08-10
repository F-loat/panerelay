import assert from 'node:assert/strict';
import test from 'node:test';
import cve from './commands/cve.js';
function context(
  requests: Array<{ url: string; query?: unknown }>,
  body: unknown = {
    vulnerabilities: [
      {
        cve: {
          id: 'CVE-2021-44228',
          published: '2021-12-10T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          vulnStatus: 'Analyzed',
          descriptions: [{ lang: 'en', value: 'Remote code execution.' }],
          metrics: {
            cvssMetricV31: [
              {
                type: 'Primary',
                cvssData: { baseScore: 10, baseSeverity: 'CRITICAL', attackVector: 'NETWORK' },
              },
            ],
          },
          weaknesses: [
            { description: [{ value: 'CWE-502' }] },
            { description: [{ value: 'CWE-502' }, { value: 'CWE-917' }] },
          ],
          cisaExploitAdd: '2021-12-10T00:00:00Z',
        },
      },
    ],
  },
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'nvd-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown }) => {
      requests.push(request);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}
test('NVD cve maps CVSS, CWE, KEV, and query fields', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const row = (
    (await cve.run(context(requests), { id: 'cve-2021-44228' })) as Array<{
      id: string;
      severity: string;
      cwe: string;
      kevAdded: string;
    }>
  )[0];
  assert.equal(row?.id, 'CVE-2021-44228');
  assert.equal(row?.severity, 'CRITICAL');
  assert.equal(row?.cwe, 'CWE-502, CWE-917');
  assert.equal(row?.kevAdded, '2021-12-10');
  assert.deepEqual(requests[0]?.query, [{ name: 'cveId', value: 'CVE-2021-44228' }]);
});
test('NVD validates CVE ids before fetching', async () => {
  await assert.rejects(() => cve.run(context([]), { id: 'not-a-cve' }), /not valid/);
  await assert.rejects(() => cve.run(context([]), { id: 'CVE-2021-123' }), /not valid/);
});
