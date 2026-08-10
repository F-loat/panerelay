import { defineCommand } from '@panerelay/site-kit';
import { DongchediClient, object, pick, score, seriesId } from '../client.js';

const AXES = [
  ['score', '综合'],
  ['space_score', '空间'],
  ['power_score', '动力'],
  ['control_score', '操控'],
  ['comfort_score', '舒适性'],
  ['appearance_score', '外观'],
  ['interiors_score', '内饰'],
  ['configuration_score', '配置'],
] as const;

export default defineCommand({
  name: 'score',
  description: 'Show the eight Dongchedi owner-rating dimensions and same-level averages.',
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
  output: ['dimension', 'score', 'sameLevelAverage'],
  examples: ['panerelay dongchedi score 649'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const props = await new DongchediClient(context).pageProps(`/auto/series/${id}`);
    const scoreInfo = object(pick(props, 'scoreSimpleInfo'));
    const reviewData = object(pick(props, 'reviewData'));
    const sameLevel = pick(reviewData, 'same_level_review');
    const average = Array.isArray(sameLevel)
      ? object(sameLevel.find(item => textId(pick(item, 'series_id')) === '0') ?? sameLevel[0])
      : object(pick(reviewData, 'average_series_review'));
    const rows = AXES.map(([key, dimension]) => ({
      dimension,
      score: score(pick(scoreInfo, key)),
      sameLevelAverage: score(pick(average, key)),
    }));
    if (rows.every(row => row.score == null))
      throw new Error(`dongchedi series ${id} has no rating`);
    return rows;
  },
});

function textId(value: unknown): string {
  return String(value ?? '');
}
