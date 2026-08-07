import {
  BilibiliClient,
  type JsonObject,
  arrayValue,
  objectValue,
  positiveInteger,
} from '../../client.js';

export function selectedPart(data: JsonObject, page: number): JsonObject {
  const pages = arrayValue(data.pages, 'video pages');
  const matches = pages
    .map(item => objectValue(item, 'video page'))
    .filter(item => Number(item.page) === page);
  if (matches.length !== 1) throw new Error(`Bilibili video page is unavailable: ${page}`);
  positiveInteger(matches[0]!.cid, 'Bilibili video cid');
  return matches[0]!;
}

export async function viewData(client: BilibiliClient, bvid: string): Promise<JsonObject> {
  return objectValue(await client.data('/x/web-interface/view', { bvid }), 'video data');
}
