import { defineCommand } from '@panerelay/site-kit';
import { bounded, docs, iso, MavenClient, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Maven Central artifacts by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Artifact, group, or tag keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum artifacts', type: 'number', default: 30 },
  ],
  output: [
    'rank',
    'coordinate',
    'groupId',
    'artifactId',
    'latestVersion',
    'packaging',
    'versions',
    'lastPublished',
    'repository',
    'url',
  ],
  examples: ['panerelay maven search jackson --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = bounded(args.limit, 30, 200);
    const rows = docs(await new MavenClient(context).search(query, limit));
    if (!rows.length) throw new Error(`maven no artifacts matched: ${query}`);
    return rows.slice(0, limit).map((item, index) => {
      const groupId = text(pick(item, 'g'));
      const artifactId = text(pick(item, 'a'));
      const coordinate = groupId && artifactId ? `${groupId}:${artifactId}` : '';
      return {
        rank: index + 1,
        coordinate,
        groupId,
        artifactId,
        latestVersion: text(pick(item, 'latestVersion')),
        packaging: text(pick(item, 'p')),
        versions: pick(item, 'versionCount') == null ? null : Number(pick(item, 'versionCount')),
        lastPublished: iso(pick(item, 'timestamp')),
        repository: text(pick(item, 'repositoryId')),
        url: coordinate ? `https://central.sonatype.com/artifact/${groupId}/${artifactId}` : '',
      };
    });
  },
});
