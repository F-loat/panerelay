import { defineCommand } from '@panerelay/site-kit';
import { BASE, GoProxyClient, limit, modulePath, sortVersions, trimDate } from '../client.js';
export default defineCommand({
  name: 'versions',
  description: 'List published Go module versions newest first.',
  access: 'read',
  args: [
    {
      name: 'module',
      description: 'Go module path',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum versions', type: 'number', default: 30 },
    {
      name: 'with-time',
      description: 'Fetch publish times for each version',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['rank', 'module', 'version', 'publishedAt', 'url'],
  examples: ['panerelay goproxy versions github.com/gin-gonic/gin --limit 10'],
  async run(context, args) {
    const value = modulePath(args.module);
    const take = limit(args.limit, 30);
    const encoded = value.split('/').map(encodeURIComponent).join('/');
    const client = new GoProxyClient(context);
    const raw = (await client.text(`/${encoded}/@v/list`))
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    const versions = sortVersions(raw).slice(0, take);
    if (!versions.length) throw new Error(`No published versions found for "${value}"`);
    const rows = versions.map((version, index) => ({
      rank: index + 1,
      module: value,
      version,
      publishedAt: null as string | null,
      url: `${BASE}/${encoded}/@v/${encodeURIComponent(version)}.info`,
    }));
    if (args['with-time'] === true)
      for (const row of rows)
        row.publishedAt = trimDate(
          (await client.json(`/${encoded}/@v/${encodeURIComponent(row.version)}.info`)).Time,
        );
    return rows;
  },
});
