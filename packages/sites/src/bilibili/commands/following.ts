import { defineCommand } from '@panerelay/site-kit';
import {
  API_ORIGIN,
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  isObject,
  objectValue,
  optionalString,
  payloadData,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';

export default defineCommand({
  name: 'following',
  description: "List one Bilibili user's followed accounts.",
  access: 'read',
  args: [
    {
      name: 'uid',
      description: 'Optional target UID; defaults to the current user',
      type: 'string',
      positional: true,
    },
    { name: 'page', description: 'Page number', type: 'number', default: 1 },
    {
      name: 'limit',
      description: 'Results per page, up to 50',
      type: 'number',
      default: 50,
    },
  ],
  output: ['mid', 'name', 'sign', 'following', 'fans'],
  examples: ['panerelay fetch bilibili following', 'panerelay fetch bilibili following 2 --page 2'],
  async run(context, args) {
    return commandFollowing(new BilibiliClient(context), args);
  },
});

export async function commandFollowing(
  client: BilibiliClient,
  args: AdapterArgs,
): Promise<unknown> {
  const uid = optionalString(args, 'uid')
    ? await client.resolveUid(requiredString(args, 'uid'))
    : await client.selfUid();
  const page = positiveInteger(args.page, 'Bilibili following page', 1);
  const limit = positiveInteger(args.limit, 'Bilibili following limit', 50, 50);
  const data = objectValue(
    payloadData(
      await client.getUrl(
        `${API_ORIGIN}/x/relation/followings?vmid=${uid}&pn=${page}&ps=${limit}&order=desc`,
        'following',
      ),
      'following',
    ),
    'following data',
  );
  const list = arrayValue(data.list ?? [], 'following list');
  if (list.length === 0) {
    return [
      {
        mid: '-',
        name: `共 ${stringValue(data.total || 0)} 人关注，当前页无数据`,
        sign: '',
        following: '',
        fans: '',
      },
    ];
  }
  return list.map(value => {
    const item = objectValue(value, 'following item');
    const verify = isObject(item.official_verify) ? item.official_verify : {};
    return {
      mid: stringValue(item.mid),
      name: stringValue(item.uname),
      sign: stringValue(item.sign).slice(0, 40),
      following: Number(item.attribute) === 6 ? '互相关注' : '已关注',
      fans: stringValue(verify.desc),
    };
  });
}
