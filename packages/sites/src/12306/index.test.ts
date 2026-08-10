import assert from 'node:assert/strict';
import test from 'node:test';
import command from './commands/stations.js';
import me from './commands/me.js';
import orders from './commands/orders.js';
import passengers from './commands/passengers.js';
import trains from './commands/trains.js';
import {
  matchStations,
  parseStationBundle,
  parseTrainRecord,
  resolveStation,
  validateDate,
} from './client.js';

const fixture =
  "var station_names ='@shh|上海虹桥|AOH|shanghaihongqiao|shh|0|0000|上海|||@bjp|北京|BJP|beijing|bj|0|0000|北京|||';";

test('parses and searches the 12306 station bundle', () => {
  const stations = parseStationBundle(fixture);
  assert.equal(stations.length, 2);
  assert.deepEqual(matchStations(stations, 'shanghai', 20), [stations[0]]);
  assert.deepEqual(matchStations(stations, 'BJP', 20), [stations[1]]);
});

test('stations maps the bundle through the adapter command', async () => {
  const rows = await command.run(
    {
      artifact: () => {
        throw new Error('No artifact fixture');
      },
      invocation: {
        protocol: 'panerelay.fetch-adapter.v3',
        requestId: 'stations',
        operation: 'execute',
        command: 'stations',
        args: {},
        fetch: {
          endpoint: 'http://127.0.0.1/fetch',
          token: 'test',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      fetch: async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: fixture,
        bodyType: 'text',
        url: 'https://kyfw.12306.cn/otn/resources/js/framework/station_name.js',
        redirected: false,
        attachedCookieCount: 0,
      }),
    },
    { keyword: '上海', limit: 5 },
  );
  assert.deepEqual(rows, [
    { name: '上海虹桥', code: 'AOH', pinyin: 'shanghaihongqiao', abbr: 'shh', city: '上海' },
  ]);
});

test('validates stations and dates and maps pipe-delimited train rows', () => {
  const stations = parseStationBundle(fixture);
  assert.equal(resolveStation(stations, '北京').code, 'BJP');
  assert.equal(validateDate('2026-08-20'), '2026-08-20');
  assert.throws(() => validateDate('2026-02-30'), /invalid/);
  const row = parseTrainRecord(
    'x|预订|24000000G10L|G10|x|x|BJP|AOH|08:00|10:30|02:30|Y|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|商务',
    new Map(stations.map(station => [station.code, station])),
  );
  assert.equal(row?.from_station, '北京');
  assert.equal(row?.to_station, '上海虹桥');
  assert.equal(row?.available, true);
});

test('trains rotates query endpoints until a usable result', async () => {
  const requests: string[] = [];
  const result = await trains.run(
    {
      artifact: () => {
        throw new Error('No artifact fixture');
      },
      invocation: {
        protocol: 'panerelay.fetch-adapter.v3',
        requestId: 'trains',
        operation: 'execute',
        command: 'trains',
        args: {},
        fetch: {
          endpoint: 'http://127.0.0.1/fetch',
          token: 'test',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      fetch: async request => {
        requests.push(request.url);
        if (request.url.endsWith('station_name.js'))
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: fixture,
            bodyType: 'text',
            url: request.url,
            redirected: false,
            attachedCookieCount: 0,
          };
        if (request.url.endsWith('/leftTicket/init'))
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: 'ok',
            bodyType: 'text',
            url: request.url,
            redirected: false,
            attachedCookieCount: 0,
          };
        if (request.url.endsWith('queryG'))
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: { status: false, c_url: 'leftTicket/queryO' },
            bodyType: 'json',
            url: request.url,
            redirected: false,
            attachedCookieCount: 0,
          };
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: {
            status: true,
            data: {
              result: [
                'x|预订|24000000G10L|G10|x|x|BJP|AOH|08:00|10:30|02:30|Y|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|x|商务',
              ],
            },
          },
          bodyType: 'json',
          url: request.url,
          redirected: false,
          attachedCookieCount: 0,
        };
      },
    },
    { from: '北京', to: '上海虹桥', date: '2026-08-20', limit: 5 },
  );
  assert.equal((result as Array<{ code: string }>)[0]?.code, 'G10');
  assert.ok(requests.some(url => url.endsWith('queryO')));
});

function accountContext(
  fetch: (
    request: Parameters<NonNullable<Parameters<typeof me.run>[0]['fetch']>>[0],
  ) => Promise<Awaited<ReturnType<NonNullable<Parameters<typeof me.run>[0]['fetch']>>>>,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'account',
      operation: 'execute' as const,
      command: 'me',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch,
  };
}

test('account commands use authenticated browser cookies and OpenCLI field mappings', async () => {
  const requests: string[] = [];
  const fetch = async (
    request: Parameters<NonNullable<Parameters<typeof me.run>[0]['fetch']>>[0],
  ) => {
    requests.push(`${request.method ?? 'GET'} ${request.url}`);
    const body = request.url.endsWith('initQueryUserInfoApi')
      ? {
          status: true,
          data: {
            userDTO: {
              email: 'alice@example.com',
              mobile_no: '13812345678',
              born_date: '1990-01-02',
              sex_code: 'F',
              country_code: 'CN',
              flag_member: '1',
              is_active: '1',
              loginUserDTO: { user_name: 'alice', real_name: '张三' },
            },
            userTypeName: '成人',
          },
        }
      : request.url.endsWith('/passengers/query')
        ? {
            status: true,
            data: {
              datas: [
                {
                  passenger_name: '李四',
                  sex_name: '男',
                  born_date: '1988-01-01',
                  passenger_id_type_name: '居民身份证',
                  passenger_id_no: '110***********',
                  mobile_no: '139****0000',
                  passenger_type_name: '成人',
                  country_code: 'CN',
                },
              ],
            },
          }
        : {
            status: true,
            data: {
              orderDBList: [
                {
                  sequence_no: 'E123',
                  station_train_code: 'G10',
                  from_station_name: '北京',
                  to_station_name: '上海',
                  tickets: [{ passenger_name: '王五' }],
                  ticket_status_name: '待支付',
                },
              ],
            },
          };
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      body,
      bodyType: 'json' as const,
      url: request.url,
      redirected: false,
      attachedCookieCount: 2,
    };
  };
  const meResult = await me.run(accountContext(fetch), { 'include-sensitive': false });
  assert.equal((meResult as Array<{ real_name: string }>)[0]?.real_name, '张*');
  const passengerResult = await passengers.run(accountContext(fetch), {
    limit: 5,
    'include-sensitive': false,
  });
  assert.equal((passengerResult as Array<{ name: string }>)[0]?.name, '李*');
  const orderResult = await orders.run(accountContext(fetch), { 'include-sensitive': false });
  assert.equal((orderResult as Array<{ order_id: string }>)[0]?.order_id, 'E123');
  assert.ok(
    requests.some(request => request.startsWith('POST https://kyfw.12306.cn/otn/passengers/query')),
  );
});
