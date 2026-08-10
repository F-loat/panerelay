import { defineCommand, SiteError, type BrowserFetchRequest } from '@panerelay/site-kit';
function clean(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export default defineCommand({
  name: 'events',
  description: 'Search Huodongxing events.',
  access: 'read',
  args: [
    { name: 'tag', description: 'Event tag.', type: 'string', default: '' },
    { name: 'city', description: 'City.', type: 'string', default: '全部' },
    { name: 'date', description: 'Start date YYYY-MM-DD.', type: 'string', default: '' },
    { name: 'date-to', description: 'End date YYYY-MM-DD.', type: 'string', default: '' },
    { name: 'event-type', description: '1 offline or 2 online.', type: 'number' },
    { name: 'qs', description: 'Event title keyword.', type: 'string', default: '' },
    { name: 'limit', description: 'Maximum events.', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'title', 'time', 'eventType', 'city', 'location', 'organizer', 'url'],
  examples: ['panerelay huodongxing events --tag AI --city 北京'],
  async run(context, args) {
    const take = Number(args.limit ?? 20);
    if (!Number.isInteger(take) || take < 1 || take > 50)
      throw new Error('huodongxing limit must be between 1 and 50');
    for (const name of ['date', 'date-to']) {
      const value = String(args[name] ?? '').trim();
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error(`huodongxing ${name} must use YYYY-MM-DD`);
    }
    const type = String(args['event-type'] ?? '').trim();
    if (type && !['1', '2'].includes(type))
      throw new Error('huodongxing event-type must be 1 or 2');
    const url = new URL('https://www.huodongxing.com/events');
    url.searchParams.set('orderby', 'o');
    url.searchParams.set('d', 'ts');
    for (const [arg, param] of [
      ['tag', 'tag'],
      ['city', 'city'],
      ['date', 'date'],
      ['date-to', 'dateTo'],
      ['event-type', 'eventType'],
      ['qs', 'qs'],
    ] as const) {
      const value = String(args[arg] ?? '').trim();
      if (value && !(arg === 'city' && value === '全部')) url.searchParams.set(param, value);
    }
    const request: BrowserFetchRequest = {
      url: url.toString(),
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new SiteError(
        'upstream-failure',
        `Huodongxing events failed with HTTP ${response.status}`,
        response.status >= 500,
      );
    const page = String(response.body);
    const chunks = [
      ...page.matchAll(
        /<[^>]+class=["'][^"']*search-tab-content-item-mesh[^"']*["'][^>]*>([\s\S]*?)(?=<[^>]+class=["'][^"']*search-tab-content-item-mesh|<\/main>|<\/section>)/gi,
      ),
    ];
    const rows = [];
    const seen = new Set<string>();
    for (const match of chunks) {
      const chunk = match[1] ?? '';
      const anchor = chunk.match(
        /<a\b[^>]*href=["'][^"']*\/event\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      const id = anchor?.[1] ?? '';
      const title = clean(
        anchor?.[2] ??
          chunk.match(
            /<img[^>]+class=["'][^"']*item-logo[^"']*["'][^>]+alt=["']([^"']+)["']/i,
          )?.[1] ??
          '',
      );
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      const location = clean(
        chunk.match(/<[^>]+class=["'][^"']*item-dress-pp[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? '',
      );
      rows.push({
        rank: rows.length + 1,
        id,
        title,
        time: clean(
          chunk.match(
            /<[^>]+class=["'][^"']*item-dress[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
          )?.[1] ?? '',
        ),
        eventType: /item-live-icon|线上|在线|直播/i.test(chunk + location)
          ? 'online'
          : /item-dress-icon/i.test(chunk)
            ? 'offline'
            : '',
        city: location,
        location,
        organizer: clean(
          chunk.match(/<[^>]+class=["'][^"']*user-name[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? '',
        ),
        url: `https://www.huodongxing.com/event/${id}`,
      });
      if (rows.length >= take) break;
    }
    if (!rows.length) throw new SiteError('empty-result', 'Huodongxing events returned no rows');
    return rows;
  },
});
