import { defineCommand } from '@panerelay/site-kit';
import { BossClient, object, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'invite',
  description: 'Send an interview invitation to a candidate.',
  access: 'write',
  args: [
    {
      name: 'uid',
      description: 'Encrypted candidate UID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'time', description: 'Interview time.', type: 'string', required: true },
    { name: 'address', description: 'Optional interview address.', type: 'string', default: '' },
    { name: 'contact', description: 'Optional contact name.', type: 'string', default: '' },
  ],
  output: ['status', 'detail'],
  examples: ['panerelay boss invite encrypted-uid --time "2026-09-01 14:00"'],
  async run(context, args) {
    const client = new BossClient(context);
    const friend = await client.friend(required(args.uid, 'uid'));
    if (!friend) throw new Error('boss candidate was not found');
    const contactPayload = await client.request(
      'https://www.zhipin.com/wapi/zpinterview/boss/interview/contactInit',
      { allowNonZero: true },
    );
    const contactData = object(pick(contactPayload, 'zpData'));
    const addressPayload = await client.request(
      'https://www.zhipin.com/wapi/zpinterview/boss/interview/listAddress',
      { allowNonZero: true },
    );
    const addressList = pick(pick(addressPayload, 'zpData'), 'list');
    const savedAddress = Array.isArray(addressList) ? object(addressList[0]) : {};
    const timeInput = required(args.time, 'time');
    const timestamp = new Date(timeInput).getTime();
    if (Number.isNaN(timestamp)) throw new Error('boss time must resemble 2026-09-01 14:00');
    const contactName = text(args.contact) || text(pick(contactData, 'contactName'));
    const address =
      text(args.address) ||
      text(pick(savedAddress, 'cityAddressText')) ||
      text(pick(savedAddress, 'addressText'));
    await client.request('https://www.zhipin.com/wapi/zpinterview/boss/interview/invite.json', {
      body: new URLSearchParams({
        uid: text(pick(friend, 'uid')),
        securityId: text(pick(friend, 'securityId')),
        encryptJobId: text(pick(friend, 'encryptJobId')),
        interviewTime: String(timestamp),
        contactId: text(pick(contactData, 'contactId')),
        contactName,
        contactPhone: text(pick(contactData, 'contactPhone')),
        address,
        interviewType: '1',
      }),
    });
    const name = text(pick(friend, 'name')) || '候选人';
    return [
      {
        status: '✅ 面试邀请已发送',
        detail: `已向 ${name} 发送面试邀请\n时间: ${timeInput}\n地点: ${address}\n联系人: ${contactName}`,
      },
    ];
  },
});
