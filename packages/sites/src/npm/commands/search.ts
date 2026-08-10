import { defineCommand } from '@panerelay/site-kit';
import { NPM_REGISTRY, NpmClient, boundedInteger, number, requireString, text } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search the public npm registry.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'name',
    'version',
    'description',
    'weeklyDownloads',
    'dependents',
    'license',
    'publisher',
    'updated',
    'url',
  ],
  examples: ['panerelay npm search react --limit 10'],
  async run(context, args) {
    const query = requireString(args.query, 'query');
    const limit = boundedInteger(args.limit, 20, 250, 'limit');
    const body = (await new NpmClient(context).json(`${NPM_REGISTRY}/-/v1/search`, {
      text: query,
      size: limit,
    })) as Record<string, unknown>;
    const objects = Array.isArray(body.objects) ? body.objects : [];
    if (!objects.length) throw new Error(`No npm packages matched "${query}"`);
    return objects.slice(0, limit).map((object, index) => {
      const item = object as Record<string, unknown>;
      const pkg = item.package as Record<string, unknown> | undefined;
      const downloads = item.downloads as Record<string, unknown> | undefined;
      const links = pkg?.links as Record<string, unknown> | undefined;
      const publisher = pkg?.publisher as Record<string, unknown> | undefined;
      return {
        rank: index + 1,
        name: text(pkg?.name),
        version: text(pkg?.version),
        description: text(pkg?.description),
        weeklyDownloads: number(downloads?.weekly),
        dependents: number(item.dependents),
        license: text(pkg?.license),
        publisher: text(publisher?.username),
        updated: text(item.updated).slice(0, 10),
        url: text(links?.npm) || `https://www.npmjs.com/package/${text(pkg?.name)}`,
      };
    });
  },
});
