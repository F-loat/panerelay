import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, localTime, object, pick, stripHtml, text } from '../client.js';

export default defineCommand({
  name: 'topic',
  description: 'Show the first page of posts in a Linux.do topic.',
  access: 'read',
  args: [
    { name: 'id', description: 'Topic ID.', type: 'number', required: true, positional: true },
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 20 },
  ],
  output: ['author', 'content', 'likes', 'created_at'],
  examples: ['panerelay linux-do topic 12345 --limit 20'],
  async run(context, args) {
    const id = bounded(args.id, 1, Number.MAX_SAFE_INTEGER);
    const limit = bounded(args.limit, 20, 100);
    const raw = pick(
      pick(await new LinuxDoClient(context).get(`/t/${id}.json`), 'post_stream'),
      'posts',
    );
    if (!Array.isArray(raw)) throw new Error('linux-do topic response is malformed');
    return raw.slice(0, limit).map(value => {
      const post = object(value);
      return {
        author: text(pick(post, 'username')),
        content: stripHtml(pick(post, 'cooked')).slice(0, 200),
        likes: pick(post, 'like_count') ?? 0,
        created_at: localTime(pick(post, 'created_at')),
      };
    });
  },
});
