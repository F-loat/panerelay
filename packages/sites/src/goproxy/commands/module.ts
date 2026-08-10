import { defineCommand } from '@panerelay/site-kit';
import { BASE, GoProxyClient, modulePath, text, trimDate } from '../client.js';
export default defineCommand({
  name: 'module',
  description: 'Get latest Go module version and origin metadata.',
  access: 'read',
  args: [
    {
      name: 'module',
      description: 'Go module path',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'module',
    'version',
    'publishedAt',
    'vcs',
    'repository',
    'commit',
    'ref',
    'pkgGoDevUrl',
    'url',
  ],
  examples: ['panerelay goproxy module github.com/gin-gonic/gin'],
  async run(context, args) {
    const value = modulePath(args.module);
    const encoded = value.split('/').map(encodeURIComponent).join('/');
    const detail = await new GoProxyClient(context).json(`/${encoded}/@latest`);
    const origin =
      detail.Origin && typeof detail.Origin === 'object'
        ? (detail.Origin as Record<string, unknown>)
        : {};
    if (!detail.Version) throw new Error(`No latest version found for "${value}"`);
    return [
      {
        module: value,
        version: text(detail.Version),
        publishedAt: trimDate(detail.Time),
        vcs: text(origin.VCS).trim(),
        repository: text(origin.URL).trim(),
        commit: text(origin.Hash).trim(),
        ref: text(origin.Ref).trim(),
        pkgGoDevUrl: `https://pkg.go.dev/${value}`,
        url: `${BASE}/${encoded}/@latest`,
      },
    ];
  },
});
