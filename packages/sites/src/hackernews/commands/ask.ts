import { defineCommand } from '@panerelay/site-kit';
import { HackerNewsClient, storyList } from '../client.js';

export default defineCommand({
  name: 'ask',
  description: 'List Hacker News Ask HN posts.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Number of stories, up to 50', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'url'],
  examples: ['panerelay hackernews ask --limit 10'],
  async run(context, args) {
    return storyList(new HackerNewsClient(context), '/askstories.json', args, 'ask');
  },
});
