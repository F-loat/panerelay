import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, localTime, object, pick, stripHtml, text } from '../client.js';

export default defineCommand({
  name: 'topic-content',
  description: 'Get the main Linux.do topic body with metadata.',
  access: 'read',
  args: [
    { name: 'id', description: 'Topic ID.', type: 'number', required: true, positional: true },
  ],
  output: ['content'],
  examples: ['panerelay linux-do topic-content 12345'],
  async run(context, args) {
    const id = bounded(args.id, 1, Number.MAX_SAFE_INTEGER);
    const payload = await new LinuxDoClient(context).get(`/t/${id}.json?include_raw=true`);
    const raw = pick(pick(payload, 'post_stream'), 'posts');
    if (!Array.isArray(raw)) throw new Error('linux-do topic response is malformed');
    const post = raw.map(object).find(item => Number(pick(item, 'post_number')) === 1);
    if (!post) throw new Error(`linux-do topic ${id} has no main post`);
    const body = text(pick(post, 'raw')) || stripHtml(pick(post, 'cooked'));
    if (!body) throw new Error(`linux-do topic ${id} has no readable content`);
    const metadata = [
      `title: ${JSON.stringify(text(pick(payload, 'title')))}`,
      `author: ${JSON.stringify(text(pick(post, 'username')))}`,
      `likes: ${Number(pick(post, 'like_count') ?? 0)}`,
      `createdAt: ${JSON.stringify(localTime(pick(post, 'created_at')))}`,
      `url: ${JSON.stringify(`https://linux.do/t/${id}`)}`,
    ];
    return [{ content: `---\n${metadata.join('\n')}\n---\n\n${body}` }];
  },
});
