import { defineCommand } from '@panerelay/site-kit';
import {
  ChinaRailClient,
  requiredString,
  resolveStation,
  TRAIN_NO_RE,
  validateDate,
} from '../client.js';

export default defineCommand({
  name: 'train',
  description: 'List every station a 12306 train calls at.',
  access: 'read',
  args: [
    {
      name: 'train-no',
      description: 'Internal train_no from trains output',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'from', description: 'Origin station', type: 'string', required: true },
    { name: 'to', description: 'Destination station', type: 'string', required: true },
    { name: 'date', description: 'Departure date in YYYY-MM-DD', type: 'string', required: true },
  ],
  output: ['station_no', 'station_name', 'arrive_time', 'start_time', 'stopover_time'],
  examples: ['panerelay 12306 train 24000000G10L --from 北京 --to 上海 --date 2026-08-20'],
  async run(context, args) {
    const trainNo = requiredString(args, 'train-no');
    if (!TRAIN_NO_RE.test(trainNo))
      throw new Error(`12306 train-no "${trainNo}" is invalid; use train_no from trains output`);
    const from = requiredString(args, 'from');
    const to = requiredString(args, 'to');
    const date = validateDate(args.date);
    const client = new ChinaRailClient(context);
    const stations = await client.stationBundle();
    const origin = resolveStation(stations, from);
    const destination = resolveStation(stations, to);
    await client.mintSession();
    const payload = (await client.query(
      '/otn/czxx/queryByTrainNo',
      {
        train_no: trainNo,
        from_station_telecode: origin.code,
        to_station_telecode: destination.code,
        depart_date: date,
      },
      '',
    )) as Record<string, unknown>;
    const data = payload.data as Record<string, unknown> | undefined;
    const stops = Array.isArray(data?.data) ? data.data : [];
    if (!stops.length) throw new Error(`No 12306 stops returned for ${trainNo}`);
    return stops.map(stop => {
      const row = stop as Record<string, unknown>;
      return {
        station_no: String(row.station_no ?? ''),
        station_name: String(row.station_name ?? ''),
        arrive_time: row.arrive_time === '----' ? '' : String(row.arrive_time ?? ''),
        start_time: row.start_time === '----' ? '' : String(row.start_time ?? ''),
        stopover_time: row.stopover_time === '----' ? '' : String(row.stopover_time ?? ''),
      };
    });
  },
});
