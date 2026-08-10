export interface ProviderFetchMcpCommand {
  command: string;
  args: string[];
  type: 'stdio';
}

export function providerFetchMcpCommand(
  executable = process.execPath,
  entry = process.argv[1],
): ProviderFetchMcpCommand {
  if (!entry) throw new Error('Panerelay Native Host entry point is unavailable');
  return { type: 'stdio', command: executable, args: [entry, '--fetch-mcp'] };
}

export function codexFetchMcpConfigOverrides(command = providerFetchMcpCommand()): string[] {
  return [
    'tools.web_search=false',
    `mcp_servers.panerelay_fetch.command=${JSON.stringify(command.command)}`,
    `mcp_servers.panerelay_fetch.args=[${command.args.map(value => JSON.stringify(value)).join(',')}]`,
  ];
}
