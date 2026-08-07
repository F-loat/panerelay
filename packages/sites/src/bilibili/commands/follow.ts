import type { FetchAdapterCommand } from '@panerelay/protocol';
import { type AdapterArgs, BilibiliClient } from '../client.js';
import { changeRelation } from './_shared/relation.js';

export const commandMetadata = {
  name: 'follow',
  description: 'Follow a Bilibili user and verify the resulting relation.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Target UID, username, or space.bilibili.com URL',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['mid', 'name', 'status', 'url'],
  examples: ['panerelay fetch bilibili follow 2'],
} satisfies FetchAdapterCommand;

export async function commandFollow(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  return changeRelation(client, args, true);
}
