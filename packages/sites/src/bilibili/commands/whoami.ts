import { defineCommand } from '@panerelay/site-kit';
import { BilibiliClient, finiteNumber, stringValue } from '../client.js';
import { loadProfile } from './_shared/profile.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the current logged-in Bilibili account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'id', 'username', 'level'],
  examples: ['panerelay fetch bilibili whoami'],
  async run(context) {
    return commandWhoami(new BilibiliClient(context));
  },
});

export async function commandWhoami(client: BilibiliClient): Promise<unknown> {
  const { data, uid } = await loadProfile(client);
  return {
    logged_in: true,
    site: 'bilibili',
    id: uid,
    username: stringValue(data.name),
    level: finiteNumber(data.level ?? 0, 'profile level'),
  };
}
