import { defineCommand } from '@panerelay/site-kit';
import {
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  finiteNumber,
  isObject,
  objectValue,
  optionalPositiveInteger,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';
import { viewData } from './_shared/video.js';

export default defineCommand({
  name: 'comments',
  description: 'Read top-level video comments or replies under one comment.',
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
      name: 'parent',
      description: 'Root comment rpid whose replies should be returned',
      type: 'number',
    },
    {
      name: 'limit',
      description: 'Number of comments, up to 50',
      type: 'number',
      default: 20,
    },
  ],
  output: ['rank', 'rpid', 'author', 'text', 'likes', 'replies', 'time'],
  examples: [
    'panerelay bilibili comments BV1xx411c7mD',
    'panerelay bilibili comments BV1xx411c7mD --parent 123',
  ],
  async run(context, args) {
    return commandComments(new BilibiliClient(context), args);
  },
});

function replyRow(value: unknown, index: number): unknown {
  const item = objectValue(value, 'comment');
  const member = isObject(item.member) ? item.member : {};
  const content = isObject(item.content) ? item.content : {};
  const ctime = finiteNumber(item.ctime, 'comment time');
  const rpid = stringValue(item.rpid);
  if (!rpid) throw new Error('Bilibili comment is missing rpid');
  return {
    rank: index + 1,
    rpid,
    author: stringValue(member.uname),
    text: stringValue(content.message).replace(/\n/g, ' ').trim(),
    likes: finiteNumber(item.like ?? 0, 'comment likes'),
    replies: finiteNumber(item.rcount ?? 0, 'comment replies'),
    time: new Date(ctime * 1_000).toISOString().slice(0, 16).replace('T', ' '),
  };
}

export async function commandComments(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const bvid = await client.resolveBvid(requiredString(args, 'bvid'));
  const parent = optionalPositiveInteger(args.parent, 'Bilibili comments parent');
  const limit = positiveInteger(args.limit, 'Bilibili comments limit', 20, 50);
  const view = await viewData(client, bvid);
  const aid = positiveInteger(view.aid, 'Bilibili video aid');
  const data = objectValue(
    parent
      ? await client.data('/x/v2/reply/reply', {
          oid: aid,
          type: 1,
          root: parent,
          pn: 1,
          ps: limit,
        })
      : await client.data('/x/v2/reply/main', { oid: aid, type: 1, mode: 3, ps: limit }, true),
    'comments data',
  );
  const replies = data.replies == null ? [] : arrayValue(data.replies, 'comment replies');
  if (replies.length === 0) throw new Error('No Bilibili comments found');
  return replies.slice(0, limit).map(replyRow);
}
