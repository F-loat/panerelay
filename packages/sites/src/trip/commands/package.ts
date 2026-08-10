import { defineCommand } from '@panerelay/site-kit';
import { TripClient, isoDate, keyword, limit, object, pick, resolveCity, text } from '../client.js';

export default defineCommand({
  name: 'package',
  description: 'Search public Trip.com flight-plus-hotel package flight options.',
  access: 'read',
  args: [
    {
      name: 'from',
      description: 'Origin city keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'to',
      description: 'Destination city keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'depart', description: 'Outbound date in YYYY-MM-DD.', type: 'string', required: true },
    { name: 'return', description: 'Return date in YYYY-MM-DD.', type: 'string', required: true },
    { name: 'adults', description: 'Number of adults.', type: 'number', default: 2 },
    { name: 'limit', description: 'Maximum package flight options.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'airline',
    'flightNo',
    'from',
    'to',
    'departure',
    'arrival',
    'stops',
    'price',
    'currency',
  ],
  examples: ['panerelay trip package Seoul Tokyo --depart 2026-10-01 --return 2026-10-05'],
  async run(context, args) {
    const from = keyword(args.from, 'from');
    const to = keyword(args.to, 'to');
    const depart = isoDate(args.depart, 'depart');
    const returning = isoDate(args.return, 'return');
    if (depart >= returning) throw new Error('trip depart must be before return');
    const adults = Number(args.adults ?? 2);
    if (!Number.isInteger(adults) || adults < 1 || adults > 9)
      throw new Error('trip adults must be an integer between 1 and 9');
    const take = limit(args.limit);
    const client = new TripClient(context);
    const origin = await resolveCity(client, from);
    const destination = await resolveCity(client, to);
    if (!origin) throw new Error(`trip could not resolve origin "${from}"`);
    if (!destination) throw new Error(`trip could not resolve destination "${to}"`);
    if (pick(origin, 'cityId') === pick(destination, 'cityId'))
      throw new Error('trip origin and destination must differ');
    const body = await client.post('https://www.trip.com/restapi/soa2/19866/FlightSelectSearch', {
      head: {
        cid: '',
        ctok: '',
        cver: '1.0',
        lang: '01',
        sid: '8888',
        syscode: '09',
        auth: '',
        xsid: '',
        extension: [
          { name: 'locale', value: 'en-US' },
          { name: 'currency', value: 'USD' },
          { name: 'productLine', value: 'FlightHotel' },
          { name: 'source', value: 'ONLINE' },
        ],
        Locale: 'en-US',
        Language: 'en',
        Currency: 'USD',
        ClientID: '',
      },
      platform: { src: 'PC', lang: 'en-US', currency: 'USD', sitesrc: 'trip' },
      flightcriteria: {
        osource: 1,
        triptype: 1,
        fmap: 19,
        sflag: 0,
        rtype: 2,
        seglist: [
          {
            segno: 1,
            ddate: depart,
            sgrade: 4,
            dcode: pick(origin, 'cityCode'),
            acode: pick(destination, 'cityCode'),
          },
        ],
        pinfo: { adults, children: 0, babys: 0 },
      },
      hotelcriteria: {
        chin: depart,
        chout: returning,
        hcityid: String(pick(destination, 'cityId')),
        rnum: 1,
      },
    });
    const groups = pick(body, 'grouplist');
    if (!Array.isArray(groups))
      throw new Error('trip package search returned an unexpected payload');
    const rows = groups
      .flatMap(group => {
        const flights = pick(group, 'flightlist');
        if (!Array.isArray(flights) || !flights.length) return [];
        const first = object(flights[0]);
        const last = object(flights.at(-1));
        const binfo = object(pick(first, 'binfo'));
        const policies = pick(group, 'policylist');
        const policy = object(Array.isArray(policies) ? policies[0] : undefined);
        const priceData = object(pick(policy, 'price'));
        const rawPrice = Number(pick(priceData, 'price'));
        const row = {
          airline: text(pick(binfo, 'airlineName')) || null,
          flightNo: text(pick(binfo, 'flightno')) || null,
          from: text(pick(object(pick(first, 'dportinfo')), 'aport')) || null,
          to: text(pick(object(pick(last, 'aportinfo')), 'aport')) || null,
          departure: text(pick(object(pick(first, 'dateinfo')), 'dtime')) || null,
          arrival: text(pick(object(pick(last, 'dateinfo')), 'atime')) || null,
          stops: flights.length - 1,
          price: Number.isFinite(rawPrice) ? rawPrice : null,
          currency: 'USD',
        };
        return row.flightNo && row.from && row.to && row.departure && row.arrival ? [row] : [];
      })
      .slice(0, take)
      .map((row, index) => ({ rank: index + 1, ...row }));
    if (!rows.length) throw new Error(`trip returned no package flights for ${from} to ${to}`);
    return rows;
  },
});
