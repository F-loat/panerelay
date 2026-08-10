import { defineCommand } from '@panerelay/site-kit';
import { BASE, LichessClient, bounded, perf, pick, text } from '../client.js';

export default defineCommand({
  name: 'top',
  description: 'List the top Lichess players for a performance type.',
  access: 'read',
  args: [
    { name: 'perf', description: 'Performance type', type: 'string', required: true },
    { name: 'limit', description: 'Maximum players', type: 'number', default: 10 },
  ],
  output: ['rank', 'username', 'id', 'title', 'rating', 'progress', 'patron', 'url'],
  examples: ['panerelay lichess top blitz --limit 10'],
  async run(context, args) {
    const performance = perf(args.perf);
    const limit = bounded(args.limit, 10, 200);
    const body = await new LichessClient(context).get(
      `/api/player/top/${limit}/${encodeURIComponent(performance)}`,
    );
    const users = pick(body, 'users');
    if (!Array.isArray(users) || !users.length)
      throw new Error(`lichess returned no leaderboard rows for ${performance}`);
    return users.slice(0, limit).map((item, index) => {
      const handle = text(pick(item, 'username'));
      const block = pick(pick(item, 'perfs'), performance);
      return {
        rank: index + 1,
        username: handle,
        id: text(pick(item, 'id')) || null,
        title: text(pick(item, 'title')) || null,
        rating: Number(pick(block, 'rating')) || null,
        progress: Number(pick(block, 'progress')) || null,
        patron: pick(item, 'patron') === true,
        url: handle
          ? `${BASE}/@/${encodeURIComponent(handle)}/perf/${encodeURIComponent(performance)}`
          : '',
      };
    });
  },
});
