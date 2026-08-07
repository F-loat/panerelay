import type { FetchAdapterCommand } from '@panerelay/protocol';
import { type AdapterArgs, BilibiliClient } from '../client.js';
import { changeRelation } from './_shared/relation.js';

export const commandMetadata = {
  name: 'unfollow',
  description: 'Unfollow a Bilibili user and verify the resulting relation.',
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
  examples: ['panerelay fetch bilibili unfollow 2'],
} satisfies FetchAdapterCommand;

export async function commandUnfollow(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  return changeRelation(client, args, false);
}
