import { defineCommand } from '@panerelay/site-kit';
import {
  HackerNewsClient,
  isObject,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';

function htmlToText(value: unknown): string {
  return stringValue(value)
    .replace(/<p>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function indent(text: string, depth: number): string {
  if (depth === 0) return text;
  const prefix = `${'  '.repeat(depth)}> `;
  return text
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}

function moreReplies(depth: number, count: number): string {
  return `${'  '.repeat(depth + 1)}[+${count} more replies]`;
}

export default defineCommand({
  name: 'read',
  description: 'Read a Hacker News story and its comment tree.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Hacker News item ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum top-level comments', type: 'number', default: 25 },
    { name: 'depth', description: 'Maximum reply depth', type: 'number', default: 2 },
    { name: 'replies', description: 'Maximum replies per comment', type: 'number', default: 5 },
    {
      name: 'max-length',
      description: 'Maximum comment characters, at least 100',
      type: 'number',
      default: 2000,
    },
  ],
  output: ['type', 'author', 'score', 'text'],
  examples: ['panerelay hackernews read 39847301 --depth 2'],
  async run(context, args) {
    const id = requiredString(args, 'id');
    if (!/^\d+$/.test(id)) throw new Error(`Hacker News id must be numeric: ${id}`);
    const client = new HackerNewsClient(context);
    const limit = positiveInteger(args.limit, 'Hacker News read limit', 25, 100);
    const depth = positiveInteger(args.depth, 'Hacker News read depth', 2, 20);
    const replies = positiveInteger(args.replies, 'Hacker News read replies', 5, 100);
    const maxLength = positiveInteger(
      args['max-length'],
      'Hacker News read max-length',
      2000,
      100_000,
    );
    if (maxLength < 100) throw new Error('Hacker News read max-length must be at least 100');

    const story = await client.get(`/item/${id}.json`);
    if (!isObject(story) || story.deleted || story.dead) {
      throw new Error(`Hacker News story ${id} was not found, deleted, or marked dead`);
    }

    const storyText = htmlToText(story.text);
    const storyParts = [stringValue(story.title)];
    if (storyText) storyParts.push(storyText);
    if (story.url) storyParts.push(stringValue(story.url));
    const result: Array<Record<string, unknown>> = [
      {
        type: 'POST',
        author: stringValue(story.by) || '[deleted]',
        score: story.score ?? 0,
        text: storyParts.join('\n').slice(0, maxLength),
      },
    ];

    async function walk(itemId: unknown, level: number): Promise<void> {
      const item = await client.get(`/item/${itemId}.json`).catch(() => undefined);
      if (!isObject(item) || item.deleted || item.dead || item.type !== 'comment') return;
      const body = htmlToText(item.text);
      result.push({
        type: `L${level}`,
        author: stringValue(item.by) || '[deleted]',
        score: '',
        text: indent(body.slice(0, maxLength), level),
      });
      const children = Array.isArray(item.kids) ? item.kids : [];
      if (level + 1 >= depth) {
        if (children.length)
          result.push({
            type: `L${level + 1}`,
            author: '',
            score: '',
            text: moreReplies(level, children.length),
          });
        return;
      }
      for (const child of children.slice(0, replies)) await walk(child, level + 1);
      if (children.length > replies) {
        result.push({
          type: `L${level + 1}`,
          author: '',
          score: '',
          text: moreReplies(level, children.length - replies),
        });
      }
    }

    const children = Array.isArray(story.kids) ? story.kids : [];
    for (const child of children.slice(0, limit)) await walk(child, 0);
    if (children.length > limit)
      result.push({
        type: '',
        author: '',
        score: '',
        text: `[+${children.length - limit} more top-level comments]`,
      });
    return result;
  },
});
