import { defineCommand } from '@panerelay/site-kit';
import {
  DongchediClient,
  object,
  pageUrl,
  pick,
  requiredText,
  score,
  seriesId,
  text,
} from '../client.js';

function rank(value: unknown): string | null {
  const section = object(value);
  const list = pick(section, 'list');
  const first = Array.isArray(list) ? list[0] : undefined;
  const position = Number(pick(first, 'rank')) || null;
  if (!position) return null;
  const name = text(pick(section, 'rank_name') ?? pick(first, 'rank_name'));
  return name ? `${name} 第${position}名` : `第${position}名`;
}

export default defineCommand({
  name: 'series',
  description: 'Show a Dongchedi car-series overview.',
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
  examples: ['panerelay dongchedi series 649'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const props = await new DongchediClient(context).pageProps(`/auto/series/${id}`);
    const head = object(pick(props, 'seriesHomeHead'));
    const scoreInfo = object(pick(props, 'scoreSimpleInfo'));
    const rankData = object(pick(props, 'rankData'));
    const tabs = pick(object(pick(props, 'carModelsData')), 'tab_list');
    const online = Array.isArray(tabs)
      ? (tabs.find(item => pick(item, 'tab_key') === 'online_all') ?? tabs[0])
      : undefined;
    const models = pick(online, 'data');
    const usedPrice =
      pick(head, 'sh_low_Price') || pick(head, 'sh_high_price')
        ? `${text(pick(head, 'sh_low_Price')) || '?'}-${text(pick(head, 'sh_high_price')) || '?'}万`
        : null;
    return [
      ['series_id', id],
      ['name', requiredText(pick(head, 'series_name'), 'series name')],
      ['brand', requiredText(pick(head, 'brand_name'), 'series brand')],
      ['sub_brand', text(pick(head, 'sub_brand_name')) || null],
      [
        'official_price',
        pick(head, 'has_official_price') ? text(pick(head, 'official_price')) : null,
      ],
      ['dealer_price', pick(head, 'has_dealer_price') ? text(pick(head, 'dealer_price')) : null],
      ['used_price', usedPrice],
      ['score', score(pick(scoreInfo, 'score'))],
      ['review_count', Number(pick(scoreInfo, 'total_review_count')) || null],
      ['sale_rank', rank(pick(rankData, 'sale'))],
      ['score_rank', rank(pick(rankData, 'score'))],
      [
        'models',
        Array.isArray(models)
          ? models.filter(item => pick(object(pick(item, 'info')), 'car_id')).length
          : null,
      ],
      ['url', pageUrl(`/auto/series/${id}`)],
    ].map(([field, value]) => ({ field, value }));
  },
});
