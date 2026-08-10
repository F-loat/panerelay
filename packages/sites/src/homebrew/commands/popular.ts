import { defineCommand } from '@panerelay/site-kit';
import { bounded, HomebrewClient, installCount, oneOf, pick, text } from '../client.js';

export default defineCommand({
  name: 'popular',
  description: 'List most-installed Homebrew formulae or casks.',
  access: 'read',
  args: [
    { name: 'type', description: 'Package type', type: 'string', default: 'formula' },
    { name: 'window', description: 'Analytics window', type: 'string', default: '30d' },
    { name: 'limit', description: 'Maximum rows', type: 'number', default: 30 },
  ],
  output: ['rank', 'token', 'type', 'installs', 'percent', 'window', 'url'],
  examples: ['panerelay homebrew popular --type cask --window 90d --limit 50'],
  async run(context, args) {
    const type = oneOf(args.type, ['formula', 'cask'], 'formula', 'type');
    const window = oneOf(args.window, ['30d', '90d', '365d'], '30d', 'window');
    const limit = bounded(args.limit);
    const path = type === 'cask' ? 'cask-install' : 'install';
    const body = await new HomebrewClient(context).request(`/analytics/${path}/${window}.json`);
    const items = pick(body, 'items');
    if (!Array.isArray(items) || !items.length)
      throw new Error(`homebrew analytics returned no items for ${type}/${window}`);
    return items.slice(0, limit).map((item, index) => {
      const identifier = text(pick(item, type));
      return {
        rank: Number(pick(item, 'number')) || index + 1,
        token: identifier,
        type,
        installs: installCount(pick(item, 'count')),
        percent: Number(pick(item, 'percent')) || null,
        window,
        url: identifier ? `https://formulae.brew.sh/${type}/${encodeURIComponent(identifier)}` : '',
      };
    });
  },
});
