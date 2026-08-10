import assert from 'node:assert/strict';
import test from 'node:test';
import query from './commands/query.js';
import vulnerability from './commands/vulnerability.js';

function context(requests: Array<{ method: string; url: string; body?: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'osv-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { method?: string; url: string; body?: { data: string } }) => {
      requests.push({
        method: request.method ?? 'GET',
        url: request.url,
        body: request.body?.data ? JSON.parse(request.body.data) : undefined,
      });
      const body = request.url.endsWith('/v1/query')
        ? {
            vulns: [
              {
                id: 'CVE-2024-1',
                summary: 'Example issue',
                published: '2024-02-03T00:00:00Z',
                modified: '2024-02-04T00:00:00Z',
                aliases: ['GHSA-test'],
                severity: [{ type: 'CVSS_V3', score: 'HIGH' }],
                affected: [{ package: { ecosystem: 'npm', name: 'lodash' } }],
              },
            ],
          }
        : {
            id: 'GHSA-test',
            summary: 'Detailed issue',
            published: '2024-01-01T00:00:00Z',
            modified: '2024-01-02T00:00:00Z',
            aliases: ['CVE-2024-1'],
            database_specific: { severity: 'CRITICAL', cwe_ids: ['CWE-79'] },
            references: [{ type: 'ADVISORY', url: 'https://example.test' }],
            affected: [{ package: { ecosystem: 'npm', name: 'lodash' } }],
          };
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

test('OSV commands map query and vulnerability detail', async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const runContext = context(requests);
  const rows = await query.run(runContext, {
    package: 'lodash',
    ecosystem: 'npm',
    version: '4.17.20',
  });
  assert.equal(rows[0]?.severity, 'HIGH');
  assert.equal(rows[0]?.affectedPackages, 'npm:lodash');
  const detail = await vulnerability.run(runContext, { id: 'GHSA-test' });
  assert.equal(detail[0]?.severity, 'CRITICAL');
  assert.equal(detail[0]?.referenceCount, 1);
  assert.deepEqual(requests[0]?.body, {
    package: { name: 'lodash', ecosystem: 'npm' },
    version: '4.17.20',
  });
});
test('OSV validates package ecosystem and vulnerability id', async () => {
  await assert.rejects(
    () => query.run(context([]), { package: 'lodash', ecosystem: 'Unknown' }),
    /not recognised/,
  );
  await assert.rejects(() => vulnerability.run(context([]), { id: 'bad id' }), /not valid/);
});
