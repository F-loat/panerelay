import { defineCommand } from '@panerelay/site-kit';
import { ChinaRailClient, maskChineseName } from '../client.js';

export default defineCommand({
  name: 'orders',
  description: 'List in-progress orders for the logged-in 12306 account.',
  access: 'read',
  args: [
    {
      name: 'include-sensitive',
      description: 'Reveal unmasked passenger names',
      type: 'boolean',
      default: false,
    },
  ],
  output: [
    'order_id',
    'order_date',
    'train_code',
    'from_station',
    'to_station',
    'departure',
    'passengers',
    'status',
    'amount',
  ],
  examples: ['panerelay 12306 orders'],
  async run(context, args) {
    const client = new ChinaRailClient(context);
    const payload = await client.authenticatedJson(
      'https://kyfw.12306.cn/otn/queryOrder/queryMyOrderNoComplete',
      'orders',
      'POST',
      '_json_att=',
    );
    const data = payload.data as Record<string, unknown> | undefined;
    const orders = Array.isArray(data?.orderDBList)
      ? data.orderDBList
      : Array.isArray(data?.orderDTODataList)
        ? data.orderDTODataList
        : Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data)
            ? data
            : [];
    if (!orders.length) throw new Error('No in-progress 12306 orders on this account');
    const include = args['include-sensitive'] === true;
    return (orders as Record<string, unknown>[]).map(order => {
      const tickets = Array.isArray(order.tickets)
        ? (order.tickets as Record<string, unknown>[])
        : [];
      const names = tickets
        .map(ticket => String(ticket.passenger_name ?? ''))
        .filter(Boolean)
        .map(name => (include ? name : maskChineseName(name)))
        .join(', ');
      return {
        order_id: String(order.sequence_no ?? order.order_id ?? order.sequenceNo ?? ''),
        order_date: String(order.order_date ?? ''),
        train_code: String(
          order.train_code_page ?? order.station_train_code ?? order.train_code ?? '',
        ),
        from_station: String(order.from_station_name_page ?? order.from_station_name ?? ''),
        to_station: String(order.to_station_name_page ?? order.to_station_name ?? ''),
        departure: String(order.start_train_date_page ?? order.start_train_date ?? ''),
        passengers: names,
        status: String(
          order.ticket_status_name ?? order.order_status_name ?? order.statusName ?? '',
        ),
        amount: String(order.ticket_total_price_page ?? order.ticket_total_price ?? ''),
      };
    });
  },
});
