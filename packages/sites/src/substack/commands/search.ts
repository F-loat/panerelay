import { defineCommand, type BrowserFetchRequest } from '@panerelay/site-kit';

type Value = Record<string, unknown>;
function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineCommand({
  name: 'search',
  description: 'Search public Substack posts or publications.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'type', description: 'posts or publications.', type: 'string', default: 'posts' },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'date', 'description', 'url'],
  examples: [
    'panerelay substack search AI --limit 10',
    'panerelay substack search AI --type publications',
  ],
  async run(context, args) {
    const keyword = text(args.keyword);
    if (!keyword) throw new Error('substack keyword cannot be empty');
    const type = text(args.type || 'posts');
    if (type !== 'posts' && type !== 'publications')
      throw new Error('substack type must be posts or publications');
    const take = Math.max(1, Math.min(Number(args.limit) || 20, 50));
    const url = new URL(
      type === 'posts'
        ? 'https://substack.com/api/v1/post/search'
        : 'https://substack.com/api/v1/profile/search',
    );
    url.searchParams.set('query', keyword);
    url.searchParams.set('page', '0');
    if (type === 'posts') url.searchParams.set('includePlatformResults', 'true');
    const request: BrowserFetchRequest = {
      url: url.toString(),
      method: 'GET',
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`substack search failed: HTTP ${response.status}`);
    const results = pick(response.body, 'results');
    if (!Array.isArray(results)) throw new Error('substack search returned an unexpected payload');
    const rows = results
      .slice(0, take)
      .map((entry, index) => {
        const item = entry as Value;
        if (type === 'posts') {
          const bylines = pick(item, 'publishedBylines');
          const first = Array.isArray(bylines) ? bylines[0] : undefined;
          return {
            rank: index + 1,
            title: text(pick(item, 'title')),
            author: text(pick(first, 'name')),
            date: text(pick(item, 'post_date')).split('T')[0],
            description: text(
              pick(item, 'description') ||
                pick(item, 'subtitle') ||
                pick(item, 'truncated_body_text'),
            ).slice(0, 150),
            url: text(pick(item, 'canonical_url')),
          };
        }
        const publicationUsers = pick(item, 'publicationUsers');
        const publication = (pick(item, 'primaryPublication') ||
          pick(Array.isArray(publicationUsers) ? publicationUsers[0] : undefined, 'publication') ||
          {}) as Value;
        const domain = text(pick(publication, 'custom_domain'));
        const subdomain = text(pick(publication, 'subdomain'));
        return {
          rank: index + 1,
          title: text(pick(publication, 'name') || pick(item, 'name')),
          author: text(pick(item, 'name')),
          date: '',
          description: text(pick(publication, 'hero_text') || pick(item, 'bio')).slice(0, 150),
          url: domain ? `https://${domain}` : subdomain ? `https://${subdomain}.substack.com` : '',
        };
      })
      .filter(row => row.title);
    if (!rows.length) throw new Error(`substack returned no ${type} for "${keyword}"`);
    return rows;
  },
});
