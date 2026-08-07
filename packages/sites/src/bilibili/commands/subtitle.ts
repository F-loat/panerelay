import type { FetchAdapterCommand } from '@panerelay/protocol';
import {
  SITE_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  finiteNumber,
  isObject,
  objectValue,
  optionalPositiveInteger,
  optionalString,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';
import { selectedPart, viewData } from './_shared/video.js';

export const commandMetadata = {
  name: 'subtitle',
  description: 'Get Bilibili video subtitles, including multipart videos.',
  access: 'read',
  args: [
    {
      name: 'bvid',
      description: 'Video BV ID, URL, or b23.tv short link',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'lang',
      description: 'Subtitle language such as zh-CN, en-US, or ai-zh',
      type: 'string',
    },
    {
      name: 'page',
      description: 'Optional 1-based multipart video selection',
      type: 'number',
    },
  ],
  output: ['index', 'from', 'to', 'content'],
  examples: [
    'panerelay fetch bilibili subtitle BV1xx411c7mD',
    'panerelay fetch bilibili subtitle BV1xx411c7mD --lang zh-CN',
  ],
} satisfies FetchAdapterCommand;

export async function commandSubtitle(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const bvid = await client.resolveBvid(requiredString(args, 'bvid'));
  const page = optionalPositiveInteger(args.page, 'Bilibili subtitle page');
  const view = await viewData(client, bvid);
  const cid = page ? selectedPart(view, page).cid : view.cid;
  const player = objectValue(
    await client.data(
      '/x/player/wbi/v2',
      { bvid, cid: positiveInteger(cid, 'Bilibili subtitle cid') },
      true,
    ),
    'player data',
  );
  const subtitle = isObject(player.subtitle) ? player.subtitle : {};
  const subtitles = arrayValue(subtitle.subtitles ?? [], 'subtitle list');
  if (subtitles.length === 0) {
    if (player.need_login_subtitle) throw new Error('Bilibili login is required to read subtitles');
    throw new Error('No Bilibili subtitles found');
  }
  const language = optionalString(args, 'lang');
  const selected = objectValue(
    subtitles.find(value => isObject(value) && value.lan === language) ?? subtitles[0],
    'subtitle entry',
  );
  const rawUrl = stringValue(selected.subtitle_url).trim();
  if (!rawUrl) throw new Error('Bilibili subtitle URL is unavailable; login may be required');
  const url = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
  if (!/^https?:\/\//i.test(url)) throw new Error('Bilibili subtitle URL is invalid');
  const document = await client.request(
    {
      url,
      headers: { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/video/${bvid}` },
      responseType: 'json',
      withCookies: false,
    },
    'subtitle document',
  );
  const entries = Array.isArray(document)
    ? document
    : arrayValue(objectValue(document, 'subtitle document').body, 'subtitle body');
  if (entries.length === 0) throw new Error('Bilibili subtitle document is empty');
  return entries.map((value, index) => {
    const item = objectValue(value, 'subtitle line');
    return {
      index: index + 1,
      from: `${finiteNumber(item.from, 'subtitle start').toFixed(2)}s`,
      to: `${finiteNumber(item.to, 'subtitle end').toFixed(2)}s`,
      content: stringValue(item.content),
    };
  });
}
