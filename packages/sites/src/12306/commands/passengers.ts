import { defineCommand } from '@panerelay/site-kit';
import { ChinaRailClient, maskChineseName, positiveInteger } from '../client.js';

export default defineCommand({
  name: 'passengers',
  description: 'List saved passengers for the logged-in 12306 account.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum passengers', type: 'number', default: 20 },
    {
      name: 'include-sensitive',
      description: 'Reveal unmasked names',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['name', 'sex', 'born_year', 'id_type', 'id_no', 'mobile', 'passenger_type', 'country'],
  examples: ['panerelay 12306 passengers'],
  async run(context, args) {
    const client = new ChinaRailClient(context);
    const limit = positiveInteger(args.limit, '12306 passenger limit', 20, 50);
    const payload = await client.authenticatedJson(
      'https://kyfw.12306.cn/otn/passengers/query',
      'passengers',
      'POST',
      `pageIndex=1&pageSize=50`,
    );
    const data = payload.data as Record<string, unknown> | undefined;
    const passengers = Array.isArray(data?.datas) ? (data.datas as Record<string, unknown>[]) : [];
    if (!passengers.length) throw new Error('No saved passengers on this 12306 account');
    const include = args['include-sensitive'] === true;
    return passengers.slice(0, limit).map(passenger => ({
      name: include
        ? String(passenger.passenger_name ?? '')
        : maskChineseName(passenger.passenger_name),
      sex: String(passenger.sex_name ?? ''),
      born_year: String(passenger.born_date ?? '').slice(0, 4),
      id_type: String(passenger.passenger_id_type_name ?? ''),
      id_no: String(passenger.passenger_id_no ?? ''),
      mobile: String(passenger.mobile_no ?? ''),
      passenger_type: String(passenger.passenger_type_name ?? ''),
      country: String(passenger.country_code ?? ''),
    }));
  },
});
