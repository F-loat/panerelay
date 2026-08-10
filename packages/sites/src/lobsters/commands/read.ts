import { defineCommand } from '@panerelay/site-kit';
import { htmlToText, indent, LobstersClient, positive, pick, text } from '../client.js';

export default defineCommand({
  name: 'read',
  description: 'Read a Lobste.rs story and its comment tree.',
  access: 'read',
  args: [
    { name: 'id', description: 'Story short id', type: 'string', required: true },
    { name: 'limit', description: 'Maximum top-level comments', type: 'number', default: 25 },
    { name: 'depth', description: 'Maximum reply depth', type: 'number', default: 2 },
    { name: 'replies', description: 'Maximum replies per comment', type: 'number', default: 5 },
    {
      name: 'max-length',
      description: 'Maximum comment characters',
      type: 'number',
      default: 2000,
    },
  ],
  output: ['type', 'author', 'score', 'text'],
  examples: ['panerelay lobsters read 6cmh6h --depth 2'],
  async run(context, args) {
    const id = text(args.id).trim();
    if (!/^[a-z0-9]+$/.test(id)) throw new Error('lobsters id must be lowercase alphanumeric');
    const limit = positive(args.limit, 'limit', 25);
    const depth = positive(args.depth, 'depth', 2);
    const replies = positive(args.replies, 'replies', 5);
    const maxLength = positive(args['max-length'], 'max-length', 2000, 10000);
    if (maxLength < 100) throw new Error('lobsters max-length must be at least 100');
    const story = await new LobstersClient(context).get(`/s/${id}.json`);
    if (!story || !pick(story, 'short_id')) throw new Error(`lobsters story not found: ${id}`);
    const body = text(pick(story, 'description_plain')) || htmlToText(pick(story, 'description'));
    const storyText = [text(pick(story, 'title')), body, text(pick(story, 'url'))]
      .filter(Boolean)
      .join('\n')
      .slice(0, maxLength);
    const rows: Array<Record<string, unknown>> = [
      {
        type: 'POST',
        author: text(pick(story, 'submitter_user')) || '[deleted]',
        score: pick(story, 'score') ?? 0,
        text: storyText,
      },
    ];
    const comments = Array.isArray(pick(story, 'comments'))
      ? (pick(story, 'comments') as unknown[])
      : [];
    const children = new Map<string, unknown[]>();
    for (const comment of comments) {
      const parent = text(pick(comment, 'parent_comment'));
      const list = children.get(parent) ?? [];
      list.push(comment);
      children.set(parent, list);
    }
    function emit(comment: unknown, level: number) {
      if (pick(comment, 'is_deleted') || pick(comment, 'is_moderated')) return;
      const commentText = (
        text(pick(comment, 'comment_plain')) || htmlToText(pick(comment, 'comment'))
      ).slice(0, maxLength);
      rows.push({
        type: `L${level}`,
        author: text(pick(comment, 'commenting_user')) || '[deleted]',
        score: pick(comment, 'score') ?? '',
        text: indent(commentText, level),
      });
      const nested = children.get(text(pick(comment, 'short_id'))) ?? [];
      if (level + 1 >= depth) {
        if (nested.length)
          rows.push({
            type: `L${level + 1}`,
            author: '',
            score: '',
            text: `${'  '.repeat(level + 1)}[+${nested.length} more replies]`,
          });
        return;
      }
      for (const child of nested.slice(0, replies)) emit(child, level + 1);
      if (nested.length > replies)
        rows.push({
          type: `L${level + 1}`,
          author: '',
          score: '',
          text: `${'  '.repeat(level + 1)}[+${nested.length - replies} more replies]`,
        });
    }
    const top = children.get('') ?? [];
    for (const comment of top.slice(0, limit)) emit(comment, 0);
    if (top.length > limit)
      rows.push({
        type: '',
        author: '',
        score: '',
        text: `[+${top.length - limit} more top-level comments]`,
      });
    return rows;
  },
});
