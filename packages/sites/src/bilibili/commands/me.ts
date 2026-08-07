import { defineCommand } from '@panerelay/site-kit';
import { BilibiliClient, finiteNumber, stringValue } from '../client.js';
import { loadProfile } from './_shared/profile.js';

export default defineCommand({
  name: 'me',
  description: 'Show the current Bilibili profile.',
  access: 'read',
  args: [],
  output: ['name', 'uid', 'level', 'coins', 'followers', 'following'],
  examples: ['panerelay fetch bilibili me'],
  async run(context) {
    return commandMe(new BilibiliClient(context));
  },
});

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
