import {
  bilibiliJumpUrl,
  finiteNumber,
  isObject,
  objectValue,
  stringValue,
  stripHtml,
} from '../../client.js';

export function dynamicItem(value: unknown): {
  id: string;
  author: string;
  text: string;
  likes: number;
  comments: number;
  type: string;
  time: string;
  url: string;
} {
  const item = objectValue(value, 'dynamic item');
  const modules = isObject(item.modules) ? item.modules : {};
  const author = isObject(modules.module_author) ? modules.module_author : {};
  const dynamic = isObject(modules.module_dynamic) ? modules.module_dynamic : {};
  const major = isObject(dynamic.major) ? dynamic.major : {};
  const archive = isObject(major.archive) ? major.archive : undefined;
  const article = isObject(major.article) ? major.article : undefined;
  const desc = isObject(dynamic.desc) ? dynamic.desc : undefined;
  const stat = isObject(modules.module_stat) ? modules.module_stat : {};
  const like = isObject(stat.like) ? stat.like : {};
  const comment = isObject(stat.comment) ? stat.comment : {};
  const types: Record<string, string> = {
    DYNAMIC_TYPE_AV: 'video',
    DYNAMIC_TYPE_DRAW: 'draw',
    DYNAMIC_TYPE_ARTICLE: 'article',
    DYNAMIC_TYPE_FORWARD: 'forward',
    DYNAMIC_TYPE_WORD: 'text',
    DYNAMIC_TYPE_LIVE_RCMD: 'live',
    DYNAMIC_TYPE_PGC: 'bangumi',
  };
  const type = types[stringValue(item.type)] ?? stringValue(item.type);
  const id = stringValue(item.id_str);
  let text = stringValue(archive?.title || article?.title || desc?.text);
  const draw = isObject(major.draw) ? major.draw : undefined;
  const imageCount = draw && Array.isArray(draw.items) ? draw.items.length : 0;
  if (!text && draw) text = imageCount > 0 ? `[图片x${imageCount}]` : '[图文动态]';
  if (!text && isObject(item.basic) && item.basic.is_only_fans) text = '[充电专属]';
  if (!text && item.type === 'DYNAMIC_TYPE_FORWARD') text = '[转发动态]';
  if (!text) text = `[${type || '动态'}]`;
  const jump = stringValue(archive?.jump_url || article?.jump_url);
  return {
    id,
    author: stringValue(author.name),
    text: stripHtml(text),
    likes: finiteNumber(like.count ?? 0, 'dynamic likes'),
    comments: finiteNumber(comment.count ?? 0, 'dynamic comments'),
    type,
    time: stringValue(author.pub_time),
    url: jump ? bilibiliJumpUrl(jump) : id ? `https://t.bilibili.com/${id}` : '',
  };
}
