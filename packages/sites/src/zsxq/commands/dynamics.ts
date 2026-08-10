import { defineCommand } from '@panerelay/site-kit';
import { author, bounded, object, pick, responseData, text, title, ZsxqClient } from '../client.js';

export default defineCommand({
  name: 'dynamics',
  description: 'List recent dynamics across joined ZSXQ groups.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 }],
  output: ['time', 'group', 'author', 'title', 'comments', 'likes', 'url'],
  examples: ['panerelay zsxq dynamics --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    const data = responseData(
      await new ZsxqClient(context).get(`/v2/dynamics?scope=general&count=${limit}`),
    );
    const raw = pick(data, 'dynamics');
    if (!Array.isArray(raw)) throw new Error('zsxq dynamics response is malformed');
    return raw.slice(0, limit).map(value => {
      const dynamic = object(value);
      const topic = object(pick(dynamic, 'topic'));
      const id = pick(topic, 'topic_id');
      if (!Object.keys(topic).length)
        return {
          time: text(pick(dynamic, 'create_time')),
          group: '',
          author: '',
          title: `[${text(pick(dynamic, 'action')) || 'unknown'}]`,
          comments: 0,
          likes: 0,
          url: '',
        };
      return {
        time: text(pick(dynamic, 'create_time')) || text(pick(topic, 'create_time')),
        group: text(pick(object(pick(topic, 'group')), 'name')),
        author: author(topic),
        title: title(topic),
        comments: pick(topic, 'comments_count') ?? 0,
        likes: pick(topic, 'likes_count') ?? 0,
        url: id ? `https://wx.zsxq.com/topic/${text(id)}` : '',
      };
    });
  },
});
