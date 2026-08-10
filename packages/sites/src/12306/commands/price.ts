import { defineCommand } from '@panerelay/site-kit';
import {
  ChinaRailClient,
  requiredString,
  resolveStation,
  TRAIN_NO_RE,
  validateDate,
} from '../client.js';

const SEAT_NAMES: Record<string, string> = {
  A9: '商务座',
  P: '特等座',
  M: '一等座',
  O: '二等座',
  A1: '硬座',
  A3: '硬卧',
  A4: '软卧',
  F: '动卧',
  WZ: '无座',
};

export default defineCommand({
  name: 'price',
  description: 'Look up 12306 ticket prices for one train segment.',
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
    {
      name: 'seat-types',
      description: 'Seat type letters',
      type: 'string',
      default: 'OM9PA1A3A4FWZ',
    },
  ],
  output: ['seat_code', 'seat_name', 'price', 'currency'],
  examples: ['panerelay 12306 price 24000000G10L --from 北京 --to 上海 --date 2026-08-20'],
  async run(context, args) {
    const trainNo = requiredString(args, 'train-no');
    if (!TRAIN_NO_RE.test(trainNo))
      throw new Error(`12306 train-no "${trainNo}" is invalid; use train_no from trains output`);
    const from = requiredString(args, 'from');
    const to = requiredString(args, 'to');
    const date = validateDate(args.date);
    const seatTypes = String(args['seat-types'] ?? 'OM9PA1A3A4FWZ');
    if (!/^[A-Z0-9]{1,32}$/.test(seatTypes))
      throw new Error('12306 seat-types must contain only A-Z and 0-9');
    const client = new ChinaRailClient(context);
    const stations = await client.stationBundle();
    const origin = resolveStation(stations, from);
    const destination = resolveStation(stations, to);
    await client.mintSession();
    const stopsPayload = (await client.query(
      '/otn/czxx/queryByTrainNo',
      {
        train_no: trainNo,
        from_station_telecode: origin.code,
        to_station_telecode: destination.code,
        depart_date: date,
      },
      '',
    )) as Record<string, unknown>;
    const stopData = stopsPayload.data as Record<string, unknown> | undefined;
    const stops = Array.isArray(stopData?.data) ? (stopData.data as Record<string, unknown>[]) : [];
    const fromStop = stops.find(stop => stop.station_name === origin.name);
    const toStop = stops.find(stop => stop.station_name === destination.name);
    if (!fromStop || !toStop)
      throw new Error('12306 train does not stop at the requested stations');
    const pricePayload = (await client.query(
      '/otn/leftTicket/queryTicketPrice',
      {
        train_no: trainNo,
        from_station_no: String(fromStop.station_no ?? ''),
        to_station_no: String(toStop.station_no ?? ''),
        seat_types: seatTypes,
        train_date: date,
      },
      '',
    )) as Record<string, unknown>;
    const data = pricePayload.data as Record<string, unknown> | undefined;
    const rows = Object.entries(data ?? {})
      .filter(
        ([code, value]) =>
          code !== 'train_no' &&
          code !== 'OT' &&
          !/^\d+$/.test(code) &&
          /^[A-Z]/.test(code) &&
          typeof value === 'string' &&
          /^[¥\d.]+$/.test(value as string),
      )
      .map(([code, value]) => ({
        seat_code: code,
        seat_name: SEAT_NAMES[code] ?? code,
        price: String(value).replace(/^¥/, ''),
        currency: 'CNY',
      }))
      .sort((a, b) => Number(b.price) - Number(a.price));
    if (!rows.length) throw new Error(`No 12306 prices returned for ${trainNo}`);
    return rows;
  },
});
