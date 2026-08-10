import { defineCommand } from '@panerelay/site-kit';
import { BossClient, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'exchange',
  description: 'Request a phone or WeChat exchange with a candidate.',
  access: 'write',
  args: [
    {
      name: 'uid',
      description: 'Encrypted candidate UID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'type', description: 'phone or wechat.', type: 'string', default: 'phone' },
  ],
  output: ['status', 'detail'],
  examples: ['panerelay boss exchange encrypted-uid --type phone'],
  async run(context, args) {
    const client = new BossClient(context);
    const uid = required(args.uid, 'uid');
    const type = text(args.type) || 'phone';
    if (!['phone', 'wechat'].includes(type))
      throw new Error('boss exchange type must be phone or wechat');
    const friend = await client.friend(uid);
    if (!friend) throw new Error('boss candidate was not found');
    const name = text(pick(friend, 'name')) || '候选人';
    await client.request('https://www.zhipin.com/wapi/zpchat/exchange/request', {
      body: new URLSearchParams({
        type: type === 'wechat' ? '2' : '1',
        securityId: text(pick(friend, 'securityId')),
        uniqueId: text(pick(friend, 'uid')),
        name,
      }),
    });
    return [
      {
        status: '✅ 交换请求已发送',
        detail: `已向 ${name} 发送${type === 'wechat' ? '微信' : '手机号'}交换请求`,
      },
    ];
  },
});
