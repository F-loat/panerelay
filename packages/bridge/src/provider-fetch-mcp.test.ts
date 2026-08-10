import assert from 'node:assert/strict';
import test from 'node:test';
import { codexFetchMcpConfigOverrides, providerFetchMcpCommand } from './provider-fetch-mcp.js';

test('builds process-local provider MCP configuration without editing user files', () => {
  const command = providerFetchMcpCommand('/opt/node', '/opt/Panerelay Host/native-host.cjs');
  assert.deepEqual(command, {
    type: 'stdio',
    command: '/opt/node',
    args: ['/opt/Panerelay Host/native-host.cjs', '--fetch-mcp'],
  });
  assert.deepEqual(codexFetchMcpConfigOverrides(command), [
    'tools.web_search=false',
    'mcp_servers.panerelay_fetch.command="/opt/node"',
    'mcp_servers.panerelay_fetch.args=["/opt/Panerelay Host/native-host.cjs","--fetch-mcp"]',
  ]);
});
