import { defineCommand } from '@panerelay/site-kit';
import { RubyGemsClient, boundedLimit, licenses, pick, required, text } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search public RubyGems by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum gems', type: 'number', default: 30 },
  ],
  output: ['rank', 'gem', 'version', 'downloads', 'license', 'authors', 'info', 'url'],
  examples: ['panerelay rubygems search rails --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = boundedLimit(args.limit, 30);
    const body = await new RubyGemsClient(context).json('/search.json', { query, page: 1 });
    const list = Array.isArray(body) ? body : [];
    if (!list.length) throw new Error(`No RubyGems matched "${query}"`);
    return list.slice(0, take).map((item, index) => {
      const name = text(pick(item, 'name'));
      return {
        rank: index + 1,
        gem: name,
        version: text(pick(item, 'version')),
        downloads: pick(item, 'downloads') == null ? null : Number(pick(item, 'downloads')),
        license: licenses(pick(item, 'licenses')),
        authors: text(pick(item, 'authors')),
        info: text(pick(item, 'info')),
        url: name ? `https://rubygems.org/gems/${name}` : '',
      };
    });
  },
});
