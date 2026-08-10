import { defineCommand } from '@panerelay/site-kit';
import {
  BASE,
  PackagistClient,
  packageName,
  pick,
  stableVersion,
  text,
  trimDate,
} from '../client.js';
export default defineCommand({
  name: 'package',
  description: 'Fetch public Packagist package metadata.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'Composer package name',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'package',
    'version',
    'releasedAt',
    'license',
    'description',
    'repository',
    'githubStars',
    'favers',
    'downloads',
    'monthlyDownloads',
    'dailyDownloads',
    'url',
  ],
  examples: ['panerelay packagist package symfony/console'],
  async run(context, args) {
    const name = packageName(args.name);
    const body = (await new PackagistClient(context).json(`/packages/${name}.json`)) as Record<
      string,
      unknown
    >;
    const pkg = pick(body, 'package');
    if (!pkg || typeof pkg !== 'object')
      throw new Error(`Packagist returned no package for ${name}`);
    const versions = pick(pkg, 'versions');
    const version = stableVersion(versions);
    const entry = pick(versions, version);
    const license = pick(entry, 'license');
    const downloads = pick(pkg, 'downloads');
    return [
      {
        package: text(pick(pkg, 'name')) || name,
        version,
        releasedAt: trimDate(pick(entry, 'time')),
        license: Array.isArray(license) ? license.filter(Boolean).join(', ') : '',
        description: text(pick(pkg, 'description')),
        repository: text(pick(pkg, 'repository')),
        githubStars: pick(pkg, 'github_stars') == null ? null : Number(pick(pkg, 'github_stars')),
        favers: pick(pkg, 'favers') == null ? null : Number(pick(pkg, 'favers')),
        downloads: pick(downloads, 'total') == null ? null : Number(pick(downloads, 'total')),
        monthlyDownloads:
          pick(downloads, 'monthly') == null ? null : Number(pick(downloads, 'monthly')),
        dailyDownloads: pick(downloads, 'daily') == null ? null : Number(pick(downloads, 'daily')),
        url: `${BASE}/packages/${name}`,
      },
    ];
  },
});
