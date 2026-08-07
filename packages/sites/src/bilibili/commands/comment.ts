import { defineCommand } from '@panerelay/site-kit';
import {
  SITE_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  objectValue,
  optionalPositiveInteger,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';
import { viewData } from './_shared/video.js';

export default defineCommand({
  name: 'comment',
  description: 'Post a top-level Bilibili video comment or reply after explicit confirmation.',
  access: 'write',
  args: [
    {
      name: 'bvid',
      description: 'Video BV ID, URL, or b23.tv short link',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'message',
      description: 'Comment text; @username mentions are resolved',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'parent', description: 'Root comment rpid to reply under', type: 'number' },
    {
      name: 'execute',
      description: 'Actually publish the comment',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['rpid', 'bvid', 'oid', 'message', 'url'],
  examples: ["panerelay fetch bilibili comment BV1xx411c7mD '测试评论' --execute"],
  async run(context, args) {
    return commandComment(new BilibiliClient(context), args);
  },
});

export async function commandComment(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const bvid = await client.resolveBvid(requiredString(args, 'bvid'));
  const message = requiredString(args, 'message');
  if (args.execute !== true)
    throw new Error('Refusing to post: pass --execute to publish the comment');
  const parent = optionalPositiveInteger(args.parent, 'Bilibili comment parent');
  const view = await viewData(client, bvid);
  const oid = positiveInteger(view.aid, 'Bilibili video aid');
  const mentions: Record<string, number> = {};
  for (const match of message.matchAll(/@([^\s@]+)/g)) {
    const name = match[1];
    if (!name || mentions[name]) continue;
    try {
      mentions[name] = positiveInteger(await client.resolveUid(name), `Bilibili mention @${name}`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('No Bilibili user found:'))
        throw error;
    }
  }
  const data = objectValue(
    await client.post('/x/v2/reply/add', {
      oid,
      type: 1,
      message,
      plat: 1,
      ...(parent ? { root: parent, parent } : {}),
      ...(Object.keys(mentions).length ? { at_name_to_mid: JSON.stringify(mentions) } : {}),
    }),
    'comment result',
  );
  const rpid = stringValue(data.rpid);
  if (!rpid) throw new Error('Bilibili comment API did not return rpid');
  return [
    { rpid, bvid, oid: String(oid), message, url: `${SITE_ORIGIN}/video/${bvid}#reply${rpid}` },
  ];
}
