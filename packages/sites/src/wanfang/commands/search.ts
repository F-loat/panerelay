import { defineCommand } from '@panerelay/site-kit';
function clean(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
export default defineCommand({
  name: 'search',
  description: 'Search Wanfang papers.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum papers.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'authors', 'source', 'year', 'type', 'cited', 'url'],
  examples: ['panerelay wanfang search 人工智能'],
  async run(context, args) {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('wanfang query is required');
    const take = Number(args.limit ?? 10);
    if (!Number.isInteger(take) || take < 1 || take > 20)
      throw new Error('wanfang limit must be between 1 and 20');
    const response = await context.fetch({
      url: `https://s.wanfangdata.com.cn/paper?q=${encodeURIComponent(query)}`,
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`wanfang request failed: HTTP ${response.status}`);
    const html = String(response.body);
    const titles = [
      ...html.matchAll(/<span[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi),
    ];
    const rows = [];
    for (const match of titles) {
      const title = clean(match[1]);
      if (title.length < 3) continue;
      const start = Math.max(0, (match.index ?? 0) - 2000);
      const end = Math.min(html.length, (match.index ?? 0) + 8000);
      const block = html.slice(start, end);
      const id = clean(
        block.match(
          /<span[^>]+class=["'][^"']*title-id-hidden[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        )?.[1],
      );
      const authors = [
        ...block.matchAll(/<span[^>]+class=["'][^"']*authors[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi),
      ]
        .map(item => clean(item[1]))
        .filter(Boolean)
        .join(', ')
        .slice(0, 80);
      const source = clean(
        block.match(
          /<span[^>]+class=["'][^"']*(?:periodical|source)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        )?.[1],
      );
      const year =
        clean(
          block.match(
            /<span[^>]+class=["'][^"']*(?:year|date)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
          )?.[1],
        ) ||
        clean(block).match(/(?:19|20)\d{2}/)?.[0] ||
        '';
      const type = clean(
        block.match(/<span[^>]+class=["'][^"']*essay-type[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
      );
      const cited =
        clean(
          block.match(
            /<[^>]+class=["'][^"']*(?:stat-item[^"']*quote|quote)[^"']*["'][^>]*>([\s\S]*?)<\//i,
          )?.[1],
        ).match(/\d+/)?.[0] ?? '0';
      rows.push({
        rank: rows.length + 1,
        title,
        authors,
        source,
        year,
        type,
        cited,
        url: id ? `https://d.wanfangdata.com.cn/${id}` : '',
      });
      if (rows.length >= take) break;
    }
    return rows;
  },
});
