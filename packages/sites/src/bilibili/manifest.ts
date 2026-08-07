import { PANERELAY_FETCH_ADAPTER_PROTOCOL, type FetchAdapterManifest } from '@panerelay/protocol';
import { BILIBILI_COMMAND_METADATA } from './commands/index.js';

export function createBilibiliManifest(version: string): FetchAdapterManifest {
  return {
    protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
    id: 'bilibili',
    name: 'Bilibili',
    version,
    description: 'Authenticated Bilibili commands using the current browser session.',
    entry: 'adapter.mjs',
    commands: BILIBILI_COMMAND_METADATA.map(command => ({
      ...command,
      args: command.args.map(argument => ({ ...argument })),
      output: [...command.output],
      examples: [...command.examples],
    })),
  };
}
