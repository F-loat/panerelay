import { defineCommand } from '@panerelay/site-kit';
import { HomebrewClient, pick, text, token } from '../client.js';

export default defineCommand({
  name: 'cask',
  description: 'Fetch Homebrew cask metadata.',
  access: 'read',
  args: [
    { name: 'token', description: 'Cask token', type: 'string', required: true, positional: true },
  ],
  output: [
    'cask',
    'tap',
    'name',
    'version',
    'description',
    'homepage',
    'deprecated',
    'disabled',
    'download',
    'url',
  ],
  examples: ['panerelay homebrew cask firefox'],
  async run(context, args) {
    const value = await new HomebrewClient(context).request(
      `/cask/${encodeURIComponent(token(args.token, 'token'))}.json`,
    );
    const body = value && typeof value === 'object' ? value : {};
    const identifier = token(args.token, 'token');
    const names = pick(body, 'name');
    return [
      {
        cask: text(pick(body, 'token')) || identifier,
        tap: text(pick(body, 'tap')),
        name: Array.isArray(names) ? names.filter(Boolean).join(', ') : text(names),
        version: text(pick(body, 'version')),
        description: text(pick(body, 'desc')),
        homepage: text(pick(body, 'homepage')),
        deprecated: Boolean(pick(body, 'deprecated')),
        disabled: Boolean(pick(body, 'disabled')),
        download: text(pick(body, 'url')),
        url: `https://formulae.brew.sh/cask/${encodeURIComponent(identifier)}`,
      },
    ];
  },
});
