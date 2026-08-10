import { defineCommand } from '@panerelay/site-kit';
import { RubyGemsClient, gemName, licenses, pick, text, trimDate } from '../client.js';
export default defineCommand({
  name: 'gem',
  description: 'Fetch public RubyGems metadata.',
  access: 'read',
  args: [
    { name: 'name', description: 'Gem name', type: 'string', required: true, positional: true },
  ],
  output: [
    'gem',
    'version',
    'releasedAt',
    'downloads',
    'versionDownloads',
    'license',
    'authors',
    'homepage',
    'source',
    'bugs',
    'info',
    'url',
  ],
  examples: ['panerelay rubygems gem rails'],
  async run(context, args) {
    const name = gemName(args.name);
    const body = (await new RubyGemsClient(context).json(
      `/gems/${encodeURIComponent(name)}.json`,
    )) as Record<string, unknown>;
    const metadata = pick(body, 'metadata');
    return [
      {
        gem: text(pick(body, 'name')) || name,
        version: text(pick(body, 'version')),
        releasedAt: trimDate(pick(body, 'version_created_at')),
        downloads: pick(body, 'downloads') == null ? null : Number(pick(body, 'downloads')),
        versionDownloads:
          pick(body, 'version_downloads') == null ? null : Number(pick(body, 'version_downloads')),
        license: licenses(pick(body, 'licenses')),
        authors: text(pick(body, 'authors')),
        homepage: text(pick(body, 'homepage_uri')),
        source: text(pick(body, 'source_code_uri')) || text(pick(metadata, 'source_code_uri')),
        bugs: text(pick(body, 'bug_tracker_uri')) || text(pick(metadata, 'bug_tracker_uri')),
        info: text(pick(body, 'info')),
        url: text(pick(body, 'project_uri')) || `https://rubygems.org/gems/${name}`,
      },
    ];
  },
});
