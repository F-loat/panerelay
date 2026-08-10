import { defineCommand } from '@panerelay/site-kit';
import { bounded, coordinate, docs, iso, MavenClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'artifact',
  description: 'Fetch Maven Central artifact version history.',
  access: 'read',
  args: [
    {
      name: 'coordinate',
      description: 'groupId:artifactId[:version]',
      type: 'string',
      required: true,
    },
    { name: 'limit', description: 'Maximum versions', type: 'number', default: 20 },
  ],
  output: ['groupId', 'artifactId', 'version', 'packaging', 'publishedAt', 'tags', 'url'],
  examples: ['panerelay maven artifact com.fasterxml.jackson.core:jackson-databind --limit 10'],
  async run(context, args) {
    const value = coordinate(args.coordinate);
    const limit = bounded(args.limit, 20, 200);
    const filters = [`g:${value.groupId}`, `a:${value.artifactId}`];
    if (value.version) filters.push(`v:${value.version}`);
    const rows = docs(
      await new MavenClient(context).search(filters.join(' AND '), value.version ? 1 : limit),
    );
    if (!rows.length) throw new Error(`maven artifact not found: ${text(args.coordinate)}`);
    return rows.map(item => {
      const version = text(pick(item, 'v'));
      return {
        groupId: text(pick(item, 'g')) || value.groupId,
        artifactId: text(pick(item, 'a')) || value.artifactId,
        version,
        packaging: text(pick(item, 'p')),
        publishedAt: iso(pick(item, 'timestamp')),
        tags: Array.isArray(pick(item, 'tags'))
          ? (pick(item, 'tags') as unknown[]).filter(Boolean).join(', ')
          : '',
        url: version
          ? `https://central.sonatype.com/artifact/${value.groupId}/${value.artifactId}/${version}`
          : '',
      };
    });
  },
});
