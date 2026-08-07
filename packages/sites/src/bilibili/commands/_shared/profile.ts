import { BilibiliClient, type JsonObject, objectValue, stringValue } from '../../client.js';

export async function loadProfile(
  client: BilibiliClient,
): Promise<{ data: JsonObject; uid: string }> {
  const uid = await client.selfUid();
  const data = objectValue(
    await client.data('/x/space/wbi/acc/info', { mid: uid }, true),
    'profile data',
  );
  const returnedUid = stringValue(data.mid || uid);
  if (returnedUid !== uid) throw new Error('Bilibili profile identity changed during the request');
  return { data, uid };
}
