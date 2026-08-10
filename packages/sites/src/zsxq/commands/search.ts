import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  explicitGroupId,
  groups,
  required,
  text,
  topicRow,
  topics,
  ZsxqClient,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search topics in a ZSXQ group.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
    { name: 'group-id', description: 'Group ID.', type: 'string', required: true },
  ],
  output: ['topic_id', 'group', 'author', 'title', 'comments', 'likes', 'time', 'url'],
  examples: ['panerelay zsxq search keyword --group-id 123456 --limit 20'],
  async run(context, args) {
    const client = new ZsxqClient(context);
    const limit = bounded(args.limit, 20, 100);
    const groupId = explicitGroupId(args['group-id']);
    let groupName = groupId;
    try {
      groupName =
        text(
          groups(await client.get('/v2/groups')).find(group => String(group.group_id) === groupId)
            ?.name,
        ) || groupId;
    } catch {
      // The search result remains useful when the optional group-name lookup fails.
    }
    return topics(
      await client.get(
        `/v2/search/groups/${encodeURIComponent(groupId)}/topics?keyword=${encodeURIComponent(required(args.keyword, 'keyword'))}&count=${limit}`,
      ),
    )
      .slice(0, limit)
      .map(item => ({ ...topicRow(item), group: groupName }));
  },
});
