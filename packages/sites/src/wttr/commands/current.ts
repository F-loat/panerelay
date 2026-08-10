import { defineCommand } from '@panerelay/site-kit';
import { numberOrNull, pick, required, text, weatherDescription, WttrClient } from '../client.js';

export default defineCommand({
  name: 'current',
  description: 'Current weather conditions for a location.',
  access: 'read',
  args: [
    {
      name: 'location',
      description: 'City, coordinates, or airport code',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'location',
    'region',
    'country',
    'latitude',
    'longitude',
    'observedAt',
    'tempC',
    'tempF',
    'feelsLikeC',
    'feelsLikeF',
    'description',
    'humidity',
    'cloudCover',
    'pressure',
    'precipMm',
    'visibilityKm',
    'uvIndex',
    'windKmph',
    'windDirection',
    'windDirectionDegree',
  ],
  examples: ['panerelay wttr current Tokyo'],
  async run(context, args) {
    const location = required(args.location, 'location');
    const body = await new WttrClient(context).request(location);
    const currentConditions = pick(body, 'current_condition');
    const current = Array.isArray(currentConditions) ? currentConditions[0] : null;
    if (!current) throw new Error(`wttr returned no current conditions for "${location}"`);
    const nearestAreas = pick(body, 'nearest_area');
    const area = Array.isArray(nearestAreas) ? nearestAreas[0] : null;
    return [
      {
        location: weatherDescription(pick(area, 'areaName')) || location,
        region: weatherDescription(pick(area, 'region')) || null,
        country: weatherDescription(pick(area, 'country')) || null,
        latitude: text(pick(area, 'latitude')) || null,
        longitude: text(pick(area, 'longitude')) || null,
        observedAt: text(pick(current, 'localObsDateTime')) || null,
        tempC: numberOrNull(pick(current, 'temp_C')),
        tempF: numberOrNull(pick(current, 'temp_F')),
        feelsLikeC: numberOrNull(pick(current, 'FeelsLikeC')),
        feelsLikeF: numberOrNull(pick(current, 'FeelsLikeF')),
        description: weatherDescription(pick(current, 'weatherDesc')) || null,
        humidity: numberOrNull(pick(current, 'humidity')),
        cloudCover: numberOrNull(pick(current, 'cloudcover')),
        pressure: numberOrNull(pick(current, 'pressure')),
        precipMm: numberOrNull(pick(current, 'precipMM')),
        visibilityKm: numberOrNull(pick(current, 'visibility')),
        uvIndex: numberOrNull(pick(current, 'uvIndex')),
        windKmph: numberOrNull(pick(current, 'windspeedKmph')),
        windDirection: text(pick(current, 'winddir16Point')) || null,
        windDirectionDegree: numberOrNull(pick(current, 'winddirDegree')),
      },
    ];
  },
});
