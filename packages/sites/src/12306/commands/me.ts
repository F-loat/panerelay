import { defineCommand } from '@panerelay/site-kit';
import { ChinaRailClient, maskChineseName, maskEmail, maskMobile } from '../client.js';

export default defineCommand({
  name: 'me',
  description: 'Show the logged-in 12306 account summary.',
  access: 'read',
  args: [
    {
      name: 'include-sensitive',
      description: 'Reveal unmasked account fields',
      type: 'boolean',
      default: false,
    },
  ],
  output: [
    'username',
    'real_name',
    'email',
    'mobile',
    'birth_date',
    'sex',
    'country',
    'user_type',
    'member',
    'active',
  ],
  examples: ['panerelay 12306 me'],
  async run(context, args) {
    const client = new ChinaRailClient(context);
    const payload = await client.authenticatedJson(
      'https://kyfw.12306.cn/otn/modifyUser/initQueryUserInfoApi',
      'account info',
    );
    const data = payload.data as Record<string, unknown> | undefined;
    const dto = data?.userDTO as Record<string, unknown> | undefined;
    if (payload.status !== true || !dto)
      throw new Error('12306 account info payload missing userDTO');
    const login = (dto.loginUserDTO ?? {}) as Record<string, unknown>;
    const include = args['include-sensitive'] === true;
    const realName = String(login.real_name ?? login.realname ?? '');
    const email = String(dto.email ?? '');
    const mobile = String(dto.mobile_no ?? '');
    const birth = String(dto.born_date ?? '');
    return [
      {
        username: String(login.user_name ?? login.name ?? ''),
        real_name: include ? realName : maskChineseName(realName),
        email: include ? email : maskEmail(email),
        mobile: include ? mobile : maskMobile(mobile),
        birth_date: include ? birth : birth.slice(0, 4),
        sex: dto.sex_code === 'M' ? '男' : dto.sex_code === 'F' ? '女' : '',
        country: String(dto.country_code ?? ''),
        user_type: String(data?.userTypeName ?? ''),
        member: dto.flag_member === '1',
        active: dto.is_active === '1',
      },
    ];
  },
});
