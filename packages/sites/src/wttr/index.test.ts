import assert from 'node:assert/strict';
import test from 'node:test';
import current from './commands/current.js';
import forecast from './commands/forecast.js';

function context(requests: Array<{ url: string; query?: unknown }>, body: unknown) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'wttr-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown }) => {
      requests.push(request);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

const sample = {
  current_condition: [
    {
      temp_C: '18',
      temp_F: '65',
      FeelsLikeC: '17',
      FeelsLikeF: '63',
      humidity: '70',
      cloudcover: '50',
      pressure: '1015',
      precipMM: '0.2',
      visibility: '10',
      uvIndex: '4',
      windspeedKmph: '12',
      winddir16Point: 'NE',
      winddirDegree: '45',
      weatherDesc: [{ value: 'Partly cloudy' }],
      localObsDateTime: '2026-05-06 10:00 AM',
    },
  ],
  nearest_area: [
    {
      areaName: [{ value: 'Tokyo' }],
      country: [{ value: 'Japan' }],
      region: [{ value: 'Tokyo' }],
      latitude: '35.685',
      longitude: '139.752',
    },
  ],
  weather: [
    {
      date: '2026-05-06',
      mintempC: '15',
      maxtempC: '22',
      avgtempC: '18',
      mintempF: '59',
      maxTempF: '72',
      avgtempF: '65',
      sunHour: '12.0',
      totalSnow_cm: '0.0',
      uvIndex: '4',
      astronomy: [{ sunrise: '04:50 AM', sunset: '06:35 PM' }],
      hourly: [{}, {}, {}, {}, { weatherDesc: [{ value: 'Sunny' }] }],
    },
  ],
};

test('wttr maps current weather and forecast', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const currentRow = (await current.run(context(requests, sample), { location: 'Tokyo' }))[0] as {
    location: string;
    country: string;
    tempC: number;
    description: string;
  };
  assert.equal(currentRow.location, 'Tokyo');
  assert.equal(currentRow.country, 'Japan');
  assert.equal(currentRow.tempC, 18);
  assert.equal(currentRow.description, 'Partly cloudy');
  assert.deepEqual(requests[0]?.query, [{ name: 'format', value: 'j1' }]);

  const forecastRow = (
    await forecast.run(context(requests, sample), { location: 'Tokyo', days: 1 })
  )[0] as {
    date: string;
    minTempC: number;
    description: string;
    sunrise: string;
  };
  assert.equal(forecastRow.date, '2026-05-06');
  assert.equal(forecastRow.minTempC, 15);
  assert.equal(forecastRow.description, 'Sunny');
  assert.equal(forecastRow.sunrise, '04:50 AM');
});

test('wttr validates locations and forecast days before fetching', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(
    () => current.run(context(requests, {}), { location: '' }),
    /cannot be empty/,
  );
  await assert.rejects(
    () => forecast.run(context(requests, {}), { location: 'Tokyo', days: 5 }),
    /between 1 and 3/,
  );
  assert.equal(requests.length, 0);
});
