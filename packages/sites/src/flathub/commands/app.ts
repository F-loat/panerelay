import { defineCommand } from '@panerelay/site-kit';
import { APP_BASE, appId, FlathubClient, joinList, latestRelease, pick, text } from '../client.js';

export default defineCommand({
  name: 'app',
  description: 'Fetch full Flathub AppStream metadata.',
  access: 'read',
  args: [
    {
      name: 'app-id',
      description: 'AppStream reverse-DNS id',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'appId',
    'name',
    'summary',
    'developer',
    'license',
    'isFreeLicense',
    'isEol',
    'categories',
    'keywords',
    'latestVersion',
    'latestReleaseDate',
    'homepage',
    'bugtracker',
    'donation',
    'url',
  ],
  examples: ['panerelay flathub app org.mozilla.firefox'],
  async run(context, args) {
    const id = appId(args['app-id']);
    const body = await new FlathubClient(context).request(`/appstream/${encodeURIComponent(id)}`);
    if (!pick(body, 'id')) throw new Error(`Flathub app "${id}" returned no metadata`);
    const urls = pick(body, 'urls');
    const release = latestRelease(pick(body, 'releases'));
    return [
      {
        appId: text(pick(body, 'id')) || id,
        name: pick(body, 'name') ?? null,
        summary: pick(body, 'summary') ?? null,
        developer: pick(body, 'developer_name') ?? null,
        license: pick(body, 'project_license') ?? null,
        isFreeLicense: pick(body, 'is_free_license') === true,
        isEol: pick(body, 'is_eol') === true,
        categories: joinList(pick(body, 'categories')),
        keywords: joinList(pick(body, 'keywords'), 8),
        latestVersion: release.version,
        latestReleaseDate: release.date,
        homepage: pick(urls, 'homepage') ?? null,
        bugtracker: pick(urls, 'bugtracker') ?? null,
        donation: pick(urls, 'donation') ?? null,
        url: `${APP_BASE}/${id}`,
      },
    ];
  },
});
