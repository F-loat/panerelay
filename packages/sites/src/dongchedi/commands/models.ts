import { defineCommand } from '@panerelay/site-kit';
import {
  DongchediClient,
  numericId,
  object,
  pick,
  requiredText,
  seriesId,
  text,
} from '../client.js';

function price(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? `${value}万` : null;
  return text(value) || null;
}

export default defineCommand({
  name: 'models',
  description: 'List on-sale or discontinued trims for a Dongchedi car series.',
  access: 'read',
  args: [
    {
      name: 'series-id',
      description: 'Numeric series ID or series URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'status', description: 'online or offline.', type: 'string', default: 'online' },
  ],
  output: ['carId', 'name', 'year', 'officialPrice', 'dealerPrice', 'ownerPrice'],
  examples: ['panerelay dongchedi models 649', 'panerelay dongchedi models 649 --status offline'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const status = text(args.status || 'online').toLowerCase();
    if (status !== 'online' && status !== 'offline')
      throw new Error('dongchedi status must be online or offline');
    const props = await new DongchediClient(context).pageProps(`/auto/series/${id}`);
    const tabs = pick(object(pick(props, 'carModelsData')), 'tab_list');
    if (!Array.isArray(tabs)) throw new Error('dongchedi models returned an unexpected payload');
    const wanted = status === 'offline' ? 'offline' : 'online_all';
    const tab =
      tabs.find(item => pick(item, 'tab_key') === wanted) ??
      (status === 'offline'
        ? tabs.find(item => /停售/.test(text(pick(item, 'tab_text'))))
        : tabs[0]);
    const data = pick(tab, 'data');
    if (!Array.isArray(data)) throw new Error(`dongchedi returned no ${status} model list`);
    const rows = data.flatMap((item, index) => {
      const info = object(pick(item, 'info'));
      const carId = pick(info, 'car_id') ?? pick(info, 'id');
      if (!carId) return [];
      return [
        {
          carId: numericId(carId, `model row ${index + 1}`),
          name: requiredText(pick(info, 'name') ?? pick(info, 'car_name'), 'model name'),
          year: text(pick(info, 'year')) || null,
          officialPrice: price(pick(info, 'official_price')),
          dealerPrice: price(pick(info, 'dealer_price')),
          ownerPrice: price(pick(info, 'owner_price')),
        },
      ];
    });
    if (!rows.length) throw new Error(`dongchedi returned no ${status} models for series ${id}`);
    return rows;
  },
});
