import { defineCommand } from '@panerelay/site-kit';
import { PYPI_BASE, PypiClient, packageName, pick, text } from '../client.js';
function projectUrl(info: unknown, keys: string[]): string {
  const urls = pick(info, 'project_urls');
  for (const key of keys) {
    const value = text(pick(info, key === 'home_page' ? key : ''));
    if (value) return value;
    if (urls && typeof urls === 'object') {
      const entry = Object.entries(urls as Record<string, unknown>).find(
        ([name]) => name.toLowerCase() === key.toLowerCase(),
      );
      if (entry) return text(entry[1]);
    }
  }
  return '';
}
export default defineCommand({
  name: 'package',
  description: 'Fetch public PyPI package metadata.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'PyPI package name',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'name',
    'latestVersion',
    'summary',
    'author',
    'license',
    'homepage',
    'repository',
    'requiresPython',
    'keywords',
    'releases',
    'firstReleased',
    'lastReleased',
    'url',
  ],
  examples: ['panerelay pypi package requests'],
  async run(context, args) {
    const name = packageName(args.name);
    const body = (await new PypiClient(context).json(
      PYPI_BASE,
      `/pypi/${encodeURIComponent(name)}/json`,
    )) as Record<string, unknown>;
    const info = pick(body, 'info');
    if (!info || !pick(info, 'name')) throw new Error(`PyPI returned no metadata for "${name}"`);
    const releases = pick(body, 'releases');
    const releaseVersions =
      releases && typeof releases === 'object'
        ? Object.entries(releases)
            .filter(([, files]) => Array.isArray(files) && files.length)
            .map(([version]) => version)
        : [];
    const dates = releaseVersions.flatMap(version => {
      const files = pick(releases, version);
      return Array.isArray(files)
        ? files.map(file => text(pick(file, 'upload_time')).slice(0, 10)).filter(Boolean)
        : [];
    });
    return [
      {
        name: text(pick(info, 'name')),
        latestVersion: text(pick(info, 'version')),
        summary: text(pick(info, 'summary')),
        author: text(pick(info, 'author')) || text(pick(info, 'author_email')),
        license: text(pick(info, 'license_expression')) || text(pick(info, 'license')),
        homepage: projectUrl(info, ['home_page', 'homepage']),
        repository: projectUrl(info, ['source', 'source code', 'repository']),
        requiresPython: text(pick(info, 'requires_python')),
        keywords: text(pick(info, 'keywords')),
        releases: releaseVersions.length,
        firstReleased: dates.sort()[0] ?? '',
        lastReleased: dates.sort().at(-1) ?? '',
        url: text(pick(info, 'package_url')) || `${PYPI_BASE}/project/${text(pick(info, 'name'))}/`,
      },
    ];
  },
});
