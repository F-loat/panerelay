import { defineCommand } from '@panerelay/site-kit';
import { BASE, DockerHubClient, boundedLimit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search public Docker Hub repositories by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum repositories', type: 'number', default: 25 },
  ],
  output: ['rank', 'image', 'official', 'stars', 'pulls', 'description', 'url'],
  examples: ['panerelay dockerhub search nginx --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = boundedLimit(args.limit, 25);
    const body = (await new DockerHubClient(context).json('/search/repositories/', {
      query,
      page_size: take,
    })) as { results?: unknown[] };
    const results = body.results ?? [];
    if (!results.length) throw new Error(`No Docker Hub repositories matched "${query}"`);
    return results.slice(0, take).map((item, index) => {
      const owner = text(pick(item, 'repo_owner'));
      const name = text(pick(item, 'repo_name'));
      const official = Boolean(pick(item, 'is_official'));
      const image = owner ? `${owner}/${name}` : official ? `library/${name}` : name;
      return {
        rank: index + 1,
        image,
        official,
        stars: pick(item, 'star_count') == null ? null : Number(pick(item, 'star_count')),
        pulls: pick(item, 'pull_count') == null ? null : Number(pick(item, 'pull_count')),
        description: text(pick(item, 'short_description')),
        url: image
          ? `https://hub.docker.com/r/${image}`
          : `${BASE}/search?q=${encodeURIComponent(query)}`,
      };
    });
  },
});
