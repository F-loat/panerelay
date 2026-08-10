import { defineCommand } from '@panerelay/site-kit';
import { BossClient, pick, required, text } from '../client.js';

const LABELS: Record<string, number> = {
  新招呼: 1,
  沟通中: 2,
  已约面: 3,
  已获取简历: 4,
  已交换电话: 5,
  已交换微信: 6,
  不合适: 7,
  牛人发起: 8,
  收藏: 11,
};

export default defineCommand({
  name: 'mark',
  description: 'Add or remove a recruiter-side candidate label.',
  access: 'write',
  args: [
    {
      name: 'uid',
      description: 'Encrypted candidate UID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'label', description: 'Label name or ID.', type: 'string', required: true },
    { name: 'remove', description: 'Remove instead of add.', type: 'boolean', default: false },
  ],
  output: ['status', 'detail'],
  examples: ['panerelay boss mark encrypted-uid --label 沟通中'],
  async run(context, args) {
    const client = new BossClient(context);
    const friend = await client.friend(required(args.uid, 'uid'));
    if (!friend) throw new Error('boss candidate was not found');
    const input = required(args.label, 'label');
    const fuzzy = Object.entries(LABELS).find(([name]) => name.includes(input));
    const labelId =
      LABELS[input] ?? fuzzy?.[1] ?? (/^\d+$/.test(input) ? Number(input) : undefined);
    if (!labelId) throw new Error(`boss unknown label: ${input}`);
    const action = args.remove ? 'deleteMark' : 'addMark';
    const query = new URLSearchParams({
      friendId: text(pick(friend, 'uid')),
      friendSource: text(pick(friend, 'friendSource') ?? 0),
      labelId: String(labelId),
    });
    await client.request(`https://www.zhipin.com/wapi/zprelation/friend/label/${action}?${query}`);
    const name = text(pick(friend, 'name')) || '候选人';
    const label = Object.entries(LABELS).find(([, id]) => id === labelId)?.[0] || String(labelId);
    return [
      {
        status: args.remove ? '✅ 标签已移除' : '✅ 标签已添加',
        detail: `${name}: ${args.remove ? '移除' : '添加'}标签「${label}」`,
      },
    ];
  },
});
