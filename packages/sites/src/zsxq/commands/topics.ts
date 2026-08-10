import { defineCommand } from '@panerelay/site-kit';
import { bounded, explicitGroupId, topicRow, topics, ZsxqClient } from '../client.js';

export default defineCommand({
  name: 'topics',
  description: 'List topics in a ZSXQ group.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
    { name: 'group-id', description: 'Group ID.', type: 'string', required: true },
  ],
  output: ['topic_id', 'type', 'author', 'title', 'comments', 'likes', 'time', 'url'],
  examples: ['panerelay zsxq topics --group-id 123456 --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    const groupId = explicitGroupId(args['group-id']);
    return topics(
      await new ZsxqClient(context).get(
        `/v2/groups/${encodeURIComponent(groupId)}/topics?scope=all&count=${limit}`,
      ),
    )
      .slice(0, limit)
      .map(topicRow);
  },
});
