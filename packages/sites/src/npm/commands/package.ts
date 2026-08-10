import { defineCommand } from '@panerelay/site-kit';
import { NPM_REGISTRY, NpmClient, requirePackageName, text } from '../client.js';

function repository(value: unknown): string {
  if (typeof value === 'string') return value.replace(/^git\+/, '').replace(/\.git$/, '');
  if (value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string')
    return String((value as { url: string }).url)
      .replace(/^git\+/, '')
      .replace(/\.git$/, '');
  return '';
}
function bugs(value: unknown): string {
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string'
    ? String((value as { url: string }).url)
    : '';
}

export default defineCommand({
  name: 'package',
  description: 'Get npm package metadata.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'npm package name',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'name',
    'latestVersion',
    'description',
    'license',
    'homepage',
    'repository',
    'bugs',
    'maintainers',
    'keywords',
    'created',
    'modified',
    'url',
  ],
  examples: ['panerelay npm package react'],
  async run(context, args) {
    const name = requirePackageName(args.name);
    const encoded = name.split('/').map(encodeURIComponent).join('/');
    const body = (await new NpmClient(context).json(`${NPM_REGISTRY}/${encoded}`)) as Record<
      string,
      unknown
    >;
    const latest = String((body['dist-tags'] as Record<string, unknown> | undefined)?.latest ?? '');
    if (!latest) throw new Error(`npm registry has no latest version for "${name}"`);
    const version =
      ((body.versions as Record<string, unknown> | undefined)?.[latest] as
        Record<string, unknown> | undefined) ?? {};
    const maintainers = Array.isArray(body.maintainers)
      ? body.maintainers
          .map(item =>
            item && typeof item === 'object'
              ? text(
                  (item as Record<string, unknown>).name || (item as Record<string, unknown>).email,
                )
              : text(item),
          )
          .filter(Boolean)
          .join(', ')
      : '';
    return [
      {
        name: text(body.name) || name,
        latestVersion: latest,
        description: text(version.description || body.description),
        license:
          typeof version.license === 'string'
            ? version.license
            : text((version.license as Record<string, unknown> | undefined)?.type),
        homepage: text(version.homepage),
        repository: repository(version.repository),
        bugs: bugs(version.bugs),
        maintainers,
        keywords: Array.isArray(version.keywords) ? version.keywords.join(', ') : '',
        created: text((body.time as Record<string, unknown> | undefined)?.created).slice(0, 10),
        modified: text((body.time as Record<string, unknown> | undefined)?.modified).slice(0, 10),
        url: `https://www.npmjs.com/package/${name}`,
      },
    ];
  },
});
