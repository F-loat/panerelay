import { defineCommand } from '@panerelay/site-kit';
import { AutohomeClient, KOUBEI_BASE, clean, pageProps, seriesId } from '../client.js';
function parseScore(props: Record<string, unknown>, id: string) {
  const base = (props.baseData ?? {}) as Record<string, unknown>;
  const quality = (props.qualityData ?? {}) as Record<string, unknown>;
  const rows: Array<{ field: string; value: unknown }> = [
    { field: 'seriesId', value: id },
    { field: 'name', value: clean(base.seriesname) },
    { field: 'brand', value: clean(base.brandName) },
    { field: 'level', value: clean(base.levelname) },
    { field: 'guidePrice', value: base.pricerange ? `${clean(base.pricerange)}万` : '' },
    {
      field: 'overall',
      value: Number.isFinite(Number(base.average ?? base.seriesAverage))
        ? Number(base.average ?? base.seriesAverage)
        : null,
    },
  ];
  for (const axis of Array.isArray(base.seriesScoreList) ? base.seriesScoreList : []) {
    const item = axis as Record<string, unknown>;
    if (clean(item.typeName)) rows.push({ field: clean(item.typeName), value: Number(item.score) });
  }
  rows.push(
    { field: 'pph', value: Number(quality.pph) || null },
    { field: 'reviewUsers', value: Number(quality.userCount) || null },
    { field: 'url', value: `${KOUBEI_BASE}/${id}` },
  );
  return rows;
}
export default defineCommand({
  name: 'score',
  description: 'Get aggregate Autohome series ratings.',
  access: 'read',
  args: [
    {
      name: 'series-id',
      description: 'Series ID or Autohome URL',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay autohome score 12345'],
  async run(context, args) {
    const id = seriesId(args['series-id']);
    const props = pageProps(await new AutohomeClient(context).text(`${KOUBEI_BASE}/${id}`));
    if (!props) throw new Error(`No Autohome rating data found for ${id}`);
    return parseScore(props, id);
  },
});
export { parseScore };
