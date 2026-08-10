import { defineCommand } from '@panerelay/site-kit';
import {
  ChinaRailClient,
  parseTrainRecord,
  positiveInteger,
  requiredString,
  resolveStation,
  validateDate,
} from '../client.js';

export default defineCommand({
  name: 'trains',
  description: 'List 12306 trains between two stations.',
  access: 'read',
  args: [
    {
      name: 'from',
      description: 'Origin station',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'to',
      description: 'Destination station',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'date', description: 'Departure date in YYYY-MM-DD', type: 'string', required: true },
    { name: 'limit', description: 'Maximum rows, up to 100', type: 'number', default: 50 },
  ],
  output: [
    'code',
    'from_station',
    'to_station',
    'start_time',
    'arrive_time',
    'duration',
    'available',
    'train_no',
  ],
  examples: ['panerelay 12306 trains 北京 上海 --date 2026-08-20'],
  async run(context, args) {
    const from = requiredString(args, 'from');
    const to = requiredString(args, 'to');
    const date = validateDate(args.date);
    const limit = positiveInteger(args.limit, '12306 train limit', 50, 100);
    const client = new ChinaRailClient(context);
    const stations = await client.stationBundle();
    const origin = resolveStation(stations, from);
    const destination = resolveStation(stations, to);
    if (origin.code === destination.code) throw new Error('12306 from and to stations must differ');
    const cookie = await client.mintSession();
    const query = await client.queryRotating(
      [
        '/otn/leftTicket/queryG',
        '/otn/leftTicket/queryO',
        '/otn/leftTicket/queryZ',
        '/otn/leftTicket/queryA',
      ],
      {
        'leftTicketDTO.train_date': date,
        'leftTicketDTO.from_station': origin.code,
        'leftTicketDTO.to_station': destination.code,
        purpose_codes: 'ADULT',
      },
      cookie,
    );
    const data = query.data as Record<string, unknown> | undefined;
    const raw = Array.isArray(data?.result) ? data.result : [];
    const stationByCode = new Map(stations.map(station => [station.code, station]));
    const rows = raw
      .map(value =>
        parseTrainRecord(decodeURIComponent(String(value).replace(/%0A/g, '')), stationByCode),
      )
      .filter(value => value !== undefined)
      .slice(0, limit);
    if (!rows.length)
      throw new Error(
        `No 12306 trains found from ${origin.name} to ${destination.name} on ${date}`,
      );
    return rows;
  },
});
