import { defineCommand } from '@panerelay/site-kit';
import { HomebrewClient, pick, text, token } from '../client.js';

export default defineCommand({
  name: 'formula',
  description: 'Fetch Homebrew formula metadata.',
  access: 'read',
  args: [
    { name: 'name', description: 'Formula name', type: 'string', required: true, positional: true },
  ],
  output: [
    'formula',
    'tap',
    'version',
    'license',
    'description',
    'homepage',
    'dependencies',
    'deprecated',
    'disabled',
    'source',
    'url',
  ],
  examples: ['panerelay homebrew formula wget'],
  async run(context, args) {
    const name = token(args.name, 'formula');
    const body = await new HomebrewClient(context).request(
      `/formula/${encodeURIComponent(name)}.json`,
    );
    const value = body && typeof body === 'object' ? body : {};
    const dependencies = Array.isArray(pick(value, 'dependencies'))
      ? (pick(value, 'dependencies') as unknown[]).filter(Boolean).join(', ')
      : '';
    const urls = pick(value, 'urls');
    const stable = pick(pick(urls, 'stable'), 'url');
    return [
      {
        formula: text(pick(value, 'name')) || name,
        tap: text(pick(value, 'tap')),
        version: text(pick(pick(value, 'versions'), 'stable')),
        license: text(pick(value, 'license')),
        description: text(pick(value, 'desc')),
        homepage: text(pick(value, 'homepage')),
        dependencies,
        deprecated: Boolean(pick(value, 'deprecated')),
        disabled: Boolean(pick(value, 'disabled')),
        source: text(stable),
        url: `https://formulae.brew.sh/formula/${encodeURIComponent(name)}`,
      },
    ];
  },
});
