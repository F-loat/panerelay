import { type AdapterArgs, BilibiliClient, requiredString } from '../../client.js';

export async function changeRelation(
  client: BilibiliClient,
  args: AdapterArgs,
  follow: boolean,
): Promise<unknown> {
  const target = requiredString(args, 'target');
  const mid = await client.resolveUid(target);
  if (mid === (await client.selfUid()))
    throw new Error(`Cannot ${follow ? 'follow' : 'unfollow'} yourself`);
  const before = await client.relation(mid);
  const currentlyFollowing = before === 2 || before === 6;
  const url = `https://space.bilibili.com/${mid}`;
  if (follow && currentlyFollowing) return [{ mid, name: '', status: 'already-following', url }];
  if (!follow && !currentlyFollowing) return [{ mid, name: '', status: 'not-following', url }];
  if (follow && before === 128) throw new Error(`Bilibili user ${mid} is blocked; unblock first`);
  await client.post('/x/relation/modify', { fid: mid, act: follow ? 1 : 2, re_src: 11 });
  await client.waitForRelation(mid, attribute =>
    follow ? attribute === 2 || attribute === 6 : attribute !== 2 && attribute !== 6,
  );
  return [{ mid, name: '', status: follow ? 'followed' : 'unfollowed', url }];
}
