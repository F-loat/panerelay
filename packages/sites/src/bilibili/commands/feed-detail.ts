import { defineCommand } from '@panerelay/site-kit';
import {
  type AdapterArgs,
  BilibiliClient,
  bilibiliJumpUrl,
  isObject,
  objectValue,
  requiredString,
  stringValue,
  stripHtml,
} from '../client.js';
import { dynamicItem } from './_shared/dynamic.js';

export default defineCommand({
  name: 'feed-detail',
  description: 'Show one Bilibili dynamic item in detail.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Dynamic ID from a feed URL',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay fetch bilibili feed-detail 123456789'],
  async run(context, args) {
    return commandFeedDetail(new BilibiliClient(context), args);
  },
});

export async function commandFeedDetail(
  client: BilibiliClient,
  args: AdapterArgs,
): Promise<unknown> {
  const id = requiredString(args, 'id');
  const data = objectValue(
    await client.data('/x/polymer/web-dynamic/v1/detail', { id, timezone_offset: -480 }),
    'feed detail data',
  );
  if (!isObject(data.item)) return [{ field: 'error', value: '动态不存在或无权查看' }];
  const item = data.item;
  const parsed = dynamicItem(item);
  const modules = isObject(item.modules) ? item.modules : {};
  const dynamic = isObject(modules.module_dynamic) ? modules.module_dynamic : {};
  const major = isObject(dynamic.major) ? dynamic.major : {};
  const rows = [
    { field: 'id', value: parsed.id || id },
    { field: 'author', value: parsed.author },
    { field: 'time', value: parsed.time },
    { field: 'type', value: parsed.type },
  ];
  const description = isObject(dynamic.desc) ? stringValue(dynamic.desc.text) : '';
  if (description) rows.push({ field: 'text', value: stripHtml(description) });
  const archive = isObject(major.archive) ? major.archive : undefined;
  if (archive) {
    const stat = isObject(archive.stat) ? archive.stat : {};
    rows.push(
      { field: 'video_title', value: stringValue(archive.title) },
      { field: 'video_desc', value: stringValue(archive.desc) },
      { field: 'video_url', value: bilibiliJumpUrl(archive.jump_url) },
      { field: 'play', value: stringValue(stat.play) },
      { field: 'danmaku', value: stringValue(stat.danmaku) },
    );
  }
  const article = isObject(major.article) ? major.article : undefined;
  if (article) {
    rows.push(
      { field: 'article_title', value: stringValue(article.title) },
      { field: 'article_url', value: bilibiliJumpUrl(article.jump_url) },
    );
  }
  const draw = isObject(major.draw) && Array.isArray(major.draw.items) ? major.draw.items : [];
  if (draw.length) {
    rows.push({
      field: 'images',
      value: draw.map(value => stringValue(objectValue(value, 'draw item').src)).join('\n'),
    });
  }
  const opus = isObject(major.opus) ? major.opus : undefined;
  const opusSummary = opus && isObject(opus.summary) ? stringValue(opus.summary.text) : '';
  if (opusSummary) rows.push({ field: 'opus_text', value: stripHtml(opusSummary) });
  if (opus?.title) rows.push({ field: 'opus_title', value: stringValue(opus.title) });
  if (isObject(item.orig)) {
    const originalModules = isObject(item.orig.modules) ? item.orig.modules : {};
    const originalAuthor = isObject(originalModules.module_author)
      ? originalModules.module_author
      : {};
    const originalDynamic = isObject(originalModules.module_dynamic)
      ? originalModules.module_dynamic
      : {};
    const originalDescription = isObject(originalDynamic.desc)
      ? stringValue(originalDynamic.desc.text)
      : '';
    rows.push({ field: 'forward_from', value: stringValue(originalAuthor.name) });
    if (originalDescription) {
      rows.push({ field: 'forward_text', value: stripHtml(originalDescription).slice(0, 200) });
    }
  }
  const stats = isObject(modules.module_stat) ? modules.module_stat : {};
  const forward = isObject(stats.forward) ? stats.forward : {};
  rows.push(
    { field: 'likes', value: String(parsed.likes) },
    { field: 'comments', value: String(parsed.comments) },
    { field: 'forwards', value: stringValue(forward.count ?? 0) },
    { field: 'url', value: `https://t.bilibili.com/${parsed.id || id}` },
  );
  return rows;
}
