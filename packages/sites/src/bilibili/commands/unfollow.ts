import { defineCommand } from '@panerelay/site-kit';
import { type AdapterArgs, BilibiliClient } from '../client.js';
import { changeRelation } from './_shared/relation.js';

export default defineCommand({
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
  async run(context, args) {
    return commandUnfollow(new BilibiliClient(context), args);
  },
});

export async function commandUnfollow(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  return changeRelation(client, args, false);
}
