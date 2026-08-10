import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  comments,
  explicitGroupId,
  pick,
  preview,
  required,
  topic,
  topicRow,
  ZsxqClient,
} from '../client.js';

export default defineCommand({
  name: 'topic',
  description: 'Show a ZSXQ topic and its comments.',
  access: 'read',
  args: [
    { name: 'id', description: 'Topic ID.', type: 'string', required: true, positional: true },
    { name: 'group-id', description: 'Group ID.', type: 'string', required: true },
    { name: 'comment-limit', description: 'Maximum comments.', type: 'number', default: 20 },
  ],
  output: ['topic_id', 'type', 'author', 'title', 'comments', 'likes', 'comment_preview', 'url'],
  examples: ['panerelay zsxq topic 987654 --group-id 123456 --comment-limit 20'],
  async run(context, args) {
    const client = new ZsxqClient(context);
    const id = required(args.id, 'id');
    const groupId = explicitGroupId(args['group-id']);
    const commentLimit = bounded(args['comment-limit'], 20, 100);
    const base = `/v2/groups/${encodeURIComponent(groupId)}/topics/${encodeURIComponent(id)}`;
    const selected = topic(await client.get(base));
    if (!selected) throw new Error(`zsxq topic not found: ${id}`);
    const rows = comments(await client.get(`${base}/comments?sort=asc&count=${commentLimit}`));
    const row = topicRow({
      ...selected,
      comments: rows,
      comments_count: pick(selected, 'comments_count') ?? rows.length,
    });
    return [
      {
        topic_id: row.topic_id,
        type: row.type,
        author: row.author,
        title: row.title,
        comments: row.comments,
        likes: row.likes,
        comment_preview: preview(rows, 5),
        url: pick(selected, 'topic_id')
          ? row.url
          : `https://wx.zsxq.com/topic/${encodeURIComponent(id)}`,
      },
    ];
  },
});
