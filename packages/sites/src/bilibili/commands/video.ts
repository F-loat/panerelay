import { defineCommand } from '@panerelay/site-kit';
import {
  type AdapterArgs,
  BilibiliClient,
  finiteNumber,
  isObject,
  optionalPositiveInteger,
  requiredString,
  stringValue,
} from '../client.js';
import { selectedPart, viewData } from './_shared/video.js';

export default defineCommand({
  name: 'video',
  description: 'Get Bilibili video metadata, statistics, payment flags, and optional part details.',
  access: 'read',
  args: [
    {
      name: 'bvid',
      description: 'BV ID, video URL, or b23.tv short link',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'page',
      description: 'Optional 1-based multipart video selection',
      type: 'number',
    },
  ],
  output: ['field', 'value'],
  examples: [
    'panerelay bilibili video BV1xx411c7mD',
    'panerelay bilibili video BV1xx411c7mD --page 2',
  ],
  async run(context, args) {
    return commandVideo(new BilibiliClient(context), args);
  },
});

export async function commandVideo(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const bvid = await client.resolveBvid(requiredString(args, 'bvid'));
  const page = optionalPositiveInteger(args.page, 'Bilibili video page');
  const data = await viewData(client, bvid);
  const stat = isObject(data.stat) ? data.stat : {};
  const owner = isObject(data.owner) ? data.owner : {};
  const rights = isObject(data.rights) ? data.rights : {};
  const paymentType = Number(rights.pay)
    ? 'vip'
    : Number(rights.ugc_pay) || Number(rights.arc_pay)
      ? 'ugc_pay'
      : data.is_upower_exclusive
        ? 'upower'
        : '';
  const part = page ? selectedPart(data, page) : undefined;
  const duration = finiteNumber(part?.duration ?? data.duration ?? 0, 'video duration');
  const title = stringValue(part?.part || data.title);
  const rows: Array<{ field: string; value: string }> = [
    { field: 'bvid', value: stringValue(data.bvid || bvid) },
    { field: 'aid', value: stringValue(data.aid) },
    { field: 'title', value: title },
    {
      field: 'author',
      value: owner.name ? `${stringValue(owner.name)} (mid: ${stringValue(owner.mid)})` : '',
    },
    { field: 'category', value: stringValue(data.tname_v2 || data.tname) },
    {
      field: 'publish_time',
      value: data.pubdate
        ? new Date(Number(data.pubdate) * 1_000).toISOString().slice(0, 16).replace('T', ' ')
        : '',
    },
    {
      field: 'duration',
      value: duration ? `${Math.floor(duration / 60)}m${duration % 60}s (${duration}s)` : '',
    },
    { field: 'view', value: stringValue(stat.view) },
    { field: 'danmaku', value: stringValue(stat.danmaku) },
    { field: 'reply', value: stringValue(stat.reply) },
    { field: 'like', value: stringValue(stat.like) },
    { field: 'coin', value: stringValue(stat.coin) },
    { field: 'favorite', value: stringValue(stat.favorite) },
    { field: 'share', value: stringValue(stat.share) },
    { field: 'parts', value: stringValue(data.videos || 1) },
    { field: 'thumbnail', value: stringValue(data.pic) },
    { field: 'description', value: stringValue(data.desc) },
    { field: 'requires_payment', value: String(!!paymentType) },
    { field: 'payment_type', value: paymentType },
    { field: 'pay_preview', value: String(!!rights.ugc_pay_preview || !!data.is_upower_preview) },
    { field: 'redirect_url', value: stringValue(data.redirect_url) },
  ];
  if (page && part) {
    rows.push(
      { field: 'page', value: String(page) },
      { field: 'cid', value: stringValue(part.cid) },
      { field: 'series_title', value: stringValue(data.title) },
    );
  }
  return rows;
}
