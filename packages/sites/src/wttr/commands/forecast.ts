import { defineCommand } from '@panerelay/site-kit';
import { numberOrNull, pick, required, text, weatherDescription, WttrClient } from '../client.js';

export default defineCommand({
  name: 'forecast',
  description: 'Multi-day weather forecast for a location.',
  access: 'read',
  args: [
    {
      name: 'location',
      description: 'City, coordinates, or airport code',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'days',
      description: 'Number of forecast days, from 1 to 3',
      type: 'number',
      default: 3,
    },
  ],
  output: [
    'rank',
    'date',
    'minTempC',
    'maxTempC',
    'avgTempC',
    'minTempF',
    'maxTempF',
    'avgTempF',
    'sunHour',
    'totalSnowCm',
    'uvIndex',
    'description',
    'sunrise',
    'sunset',
  ],
  examples: ['panerelay wttr forecast Paris --days 2'],
  async run(context, args) {
    const location = required(args.location, 'location');
    const days = args.days == null ? 3 : Number(args.days);
    if (!Number.isInteger(days) || days < 1 || days > 3)
      throw new Error('wttr days must be an integer between 1 and 3');
    const body = await new WttrClient(context).request(location);
    const forecast = pick(body, 'weather');
    if (!Array.isArray(forecast) || !forecast.length)
      throw new Error(`wttr returned no forecast for "${location}"`);
    return forecast.slice(0, days).map((day, index) => {
      const hourly = pick(day, 'hourly');
      const noon = Array.isArray(hourly) ? (hourly[4] ?? hourly[0]) : null;
      const astronomy = pick(day, 'astronomy');
      const astro = Array.isArray(astronomy) ? astronomy[0] : null;
      return {
        rank: index + 1,
        date: text(pick(day, 'date')) || null,
        minTempC: numberOrNull(pick(day, 'mintempC')),
        maxTempC: numberOrNull(pick(day, 'maxtempC')),
        avgTempC: numberOrNull(pick(day, 'avgtempC')),
        minTempF: numberOrNull(pick(day, 'mintempF')),
        maxTempF: numberOrNull(pick(day, 'maxtempF')),
        avgTempF: numberOrNull(pick(day, 'avgtempF')),
        sunHour: numberOrNull(pick(day, 'sunHour')),
        totalSnowCm: numberOrNull(pick(day, 'totalSnow_cm')),
        uvIndex: numberOrNull(pick(day, 'uvIndex')),
        description: weatherDescription(pick(noon, 'weatherDesc')) || null,
        sunrise: text(pick(astro, 'sunrise')) || null,
        sunset: text(pick(astro, 'sunset')) || null,
      };
    });
  },
});
