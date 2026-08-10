import { defineCommand } from '@panerelay/site-kit';
import { DongchediClient, object, pick, seriesId, text } from '../client.js';

function values(input: unknown, key: string): string | null {
  if (!Array.isArray(input)) return null;
  const result = [...new Set(input.map(item => text(pick(item, key))).filter(Boolean))];
  return result.join(' / ') || null;
}

function range(input: unknown, key: string): string | null {
  if (!Array.isArray(input)) return null;
  const numbers = input
    .map(item => Number.parseFloat(text(pick(item, key)).replace(/[^\d.]/g, '')))
    .filter(Number.isFinite);
  if (!numbers.length) return null;
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  return low === high ? `${low}s` : `${low}-${high}s`;
}

export default defineCommand({
  name: 'specs',
  description: 'Show the unsigned Dongchedi configuration overview for a car series.',
  access: 'read',
  args: [
    {
      name: 'series-id',
      description: 'Numeric series ID or series URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay dongchedi specs 649'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const props = await new DongchediClient(context).pageProps(`/auto/series/${id}`);
    const overview = object(pick(props, 'overviewData'));
    const spaces = pick(overview, 'space');
    const space = object(Array.isArray(spaces) ? spaces[0] : undefined);
    const power = object(pick(overview, 'power'));
    const powerItems = pick(power, 'power_item');
    const manipulations = pick(overview, 'manipulation');
    const manipulation = object(Array.isArray(manipulations) ? manipulations[0] : undefined);
    const dimensions =
      pick(space, 'length') && pick(space, 'width') && pick(space, 'height')
        ? `${String(pick(space, 'length'))} × ${String(pick(space, 'width'))} × ${String(pick(space, 'height'))} mm`
        : null;
    const drivetrain =
      [text(pick(manipulation, 'driver_form')), text(pick(manipulation, 'fourwheel_drive_type'))]
        .filter(Boolean)
        .join(' · ') || null;
    const suspension =
      pick(manipulation, 'front_suspension_form') || pick(manipulation, 'rear_suspension_form')
        ? `前 ${text(pick(manipulation, 'front_suspension_form')) || '?'} / 后 ${text(pick(manipulation, 'rear_suspension_form')) || '?'}`
        : null;
    const rows = [
      ['series_id', id],
      ['dimensions', dimensions],
      ['wheelbase', pick(space, 'wheelbase') ? `${String(pick(space, 'wheelbase'))} mm` : null],
      ['power', text(pick(power, 'overview')) || null],
      ['engine', values(powerItems, 'engine_description')],
      ['gearbox', values(powerItems, 'gearbox_description')],
      ['energy', values(powerItems, 'fuel_form')],
      ['acceleration', range(powerItems, 'acceleration_time')],
      ['drivetrain', drivetrain],
      ['suspension', suspension],
    ].map(([field, value]) => ({ field, value }));
    if (rows.every(row => row.field === 'series_id' || !row.value)) {
      throw new Error(`dongchedi series ${id} has no configuration overview`);
    }
    return rows;
  },
});
