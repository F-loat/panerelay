import type { FetchAdapterCommand } from '@panerelay/protocol';
import { BilibiliClient, finiteNumber, stringValue } from '../client.js';
import { loadProfile } from './_shared/profile.js';

export const commandMetadata = {
  name: 'me',
  description: 'Show the current Bilibili profile.',
  access: 'read',
  args: [],
  output: ['name', 'uid', 'level', 'coins', 'followers', 'following'],
  examples: ['panerelay fetch bilibili me'],
} satisfies FetchAdapterCommand;

export async function commandMe(client: BilibiliClient): Promise<unknown> {
  const { data, uid } = await loadProfile(client);
  return {
    name: stringValue(data.name),
    uid,
    level: finiteNumber(data.level ?? 0, 'profile level'),
    coins: finiteNumber(data.coins ?? 0, 'profile coins'),
    followers: finiteNumber(data.follower ?? 0, 'profile followers'),
    following: finiteNumber(data.following ?? 0, 'profile following'),
  };
}
