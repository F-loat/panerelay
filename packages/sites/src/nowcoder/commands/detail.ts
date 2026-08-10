import { defineCommand } from '@panerelay/site-kit';
import { NowCoderClient, object, pick, required, stripHtml, text } from '../client.js';

export default defineCommand({
  name: 'detail',
  description: 'Show a NowCoder post by numeric ID, UUID, or discussion URL.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Post ID, UUID, or discussion URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'title',
    'author',
    'school',
    'content',
    'likes',
    'comments',
    'views',
    'time',
    'location',
  ],
  examples: ['panerelay nowcoder detail 12345678'],
  async run(context, args) {
    const client = new NowCoderClient(context);
    const raw = required(args.id, 'id');
    const id = raw.match(/discuss\/(\d+)/)?.[1] ?? raw;
    let data: Record<string, unknown> | undefined;

    const load = async (kind: 'content-data' | 'moment-data') => {
      try {
        return object(
          pick(
            await client.authenticatedGet(`detail/${kind}/detail/${encodeURIComponent(id)}`),
            'data',
          ),
        );
      } catch {
        return {};
      }
    };
    if (/[a-f]/i.test(id) && id.length > 20) data = await load('moment-data');
    if ((!data || !Object.keys(data).length) && /^\d+$/.test(id)) data = await load('content-data');
    if ((!data || !Object.keys(data).length) && /^\d+$/.test(id)) data = await load('moment-data');
    if (!data || !Object.keys(data).length) throw new Error(`nowcoder post not found: ${id}`);

    const user = object(pick(data, 'userBrief'));
    const frequency = object(pick(data, 'frequencyData'));
    const createdAt = Number(pick(data, 'createdAt'));
    const time = Number.isFinite(createdAt) ? new Date(createdAt).toISOString().slice(0, 19) : '';
    return [
      {
        title: text(pick(data, 'title')) || '(untitled)',
        author: text(pick(user, 'nickname')),
        school: text(pick(user, 'educationInfo')),
        content: stripHtml(pick(data, 'content')).slice(0, 500),
        likes: pick(frequency, 'likeCnt') ?? 0,
        comments: pick(frequency, 'commentCnt') ?? pick(frequency, 'totalCommentCnt') ?? 0,
        views: pick(frequency, 'viewCnt') ?? 0,
        time,
        location: text(pick(data, 'ip4Location')),
      },
    ];
  },
});
