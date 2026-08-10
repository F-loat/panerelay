import { defineCommand } from '@panerelay/site-kit';
import { bounded, GitHubTrendingClient, parse, since, text } from '../client.js';

export default defineCommand({
  name: 'repos',
  description: 'List public GitHub Trending repositories.',
  access: 'read',
  args: [
    {
      name: 'since',
      description: 'Time range: daily, weekly, or monthly',
      type: 'string',
      default: 'daily',
    },
    { name: 'language', description: 'Optional language slug', type: 'string', default: '' },
    { name: 'limit', description: 'Maximum repositories', type: 'number', default: 25 },
  ],
  output: ['rank', 'repo', 'description', 'language', 'stars', 'forks', 'starsSince', 'url'],
  examples: ['panerelay github-trending repos --language rust --since weekly --limit 10'],
  async run(context, args) {
    const period = since(args.since);
    const limit = bounded(args.limit);
    const language = text(args.language);
    const rows = parse(await new GitHubTrendingClient(context).request(language, period), limit);
    if (!rows.length)
      throw new Error(
        `github-trending no repositories found for ${language || 'all languages'} (${period})`,
      );
    return rows.map((row, index) => ({ rank: index + 1, ...row }));
  },
});
