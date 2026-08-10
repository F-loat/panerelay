import { defineCommand } from '@panerelay/site-kit';
import {
  APP_BASE,
  boundedLimit,
  FlathubClient,
  joinList,
  pick,
  required,
  text,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Flathub apps by keyword.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum apps', type: 'number', default: 25 },
  ],
  output: [
    'rank',
    'appId',
    'name',
    'summary',
    'developer',
    'license',
    'isFreeLicense',
    'mainCategories',
    'installsLastMonth',
    'updatedAt',
    'url',
  ],
  examples: ['panerelay flathub search firefox'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const limit = boundedLimit(args.limit);
    const body = pick(
      await new FlathubClient(context).request('/search', 'POST', {
        query,
        hitsPerPage: limit,
        page: 1,
      }),
      'hits',
    );
    const hits = Array.isArray(body) ? body : [];
    if (!hits.length) throw new Error(`No Flathub apps matched "${query}"`);
    return hits.slice(0, limit).map((hit, index) => {
      const id = text(pick(hit, 'app_id'));
      const updated = pick(hit, 'updated_at');
      return {
        rank: index + 1,
        appId: id || null,
        name: pick(hit, 'name') ?? null,
        summary: pick(hit, 'summary') ?? null,
        developer: pick(hit, 'developer_name') ?? null,
        license: pick(hit, 'project_license') ?? null,
        isFreeLicense: pick(hit, 'is_free_license') === true,
        mainCategories:
          typeof pick(hit, 'main_categories') === 'string'
            ? pick(hit, 'main_categories')
            : joinList(pick(hit, 'main_categories')),
        installsLastMonth:
          typeof pick(hit, 'installs_last_month') === 'number'
            ? pick(hit, 'installs_last_month')
            : null,
        updatedAt:
          typeof updated === 'number' && updated > 0
            ? new Date(updated * 1000).toISOString().slice(0, 10)
            : text(updated) || null,
        url: id ? `${APP_BASE}/${id}` : '',
      };
    });
  },
});
