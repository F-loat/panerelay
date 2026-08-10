import { defineCommand } from '@panerelay/site-kit';
import { AutohomeClient, BASE, bounded, clean, resolveInitial, required } from '../client.js';
function parseSeries(html: string, brand: string, count: number) {
  const wanted = clean(brand).replace(/[·\s]/g, '');
  const blocks = html.match(/<dl[^>]*>[\s\S]*?<\/dl>/g) ?? [];
  const block = /^[a-z]$/i.test(brand)
    ? html
    : blocks.find(
        item =>
          clean(item.match(/<dt>[\s\S]*?<div>\s*<a[^>]*>([^<]+)<\/a>/)?.[1]).replace(
            /[·\s]/g,
            '',
          ) === wanted,
      );
  if (!block) return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const match of block.matchAll(/<li id="s(\d+)">([\s\S]*?)<\/li>/g)) {
    const body = match[2] ?? '';
    const name = clean(
      body.match(/<h4>\s*<a[^>]*>([^<]+)<\/a>/)?.[1] ?? body.match(/<a[^>]*>([^<]+)<\/a>/)?.[1],
    );
    if (!name) continue;
    let price = clean(
      body.match(/指导价[：:]\s*<[^>]*>([^<]+)</)?.[1] ?? body.match(/指导价[：:]\s*([^<]+)/)?.[1],
    );
    if (/暂无|未上市|停售/.test(price)) price = '';
    rows.push({ seriesId: match[1], name, price, url: `${BASE}/${match[1]}/` });
    if (rows.length >= count) break;
  }
  return rows;
}
export default defineCommand({
  name: 'brand',
  description: 'List Autohome car series by brand.',
  access: 'read',
  args: [
    {
      name: 'brand',
      description: 'Brand name or catalog letter',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum series', type: 'number', default: 60 },
  ],
  output: ['seriesId', 'name', 'price', 'url'],
  examples: ['panerelay autohome brand BMW'],
  async run(context, args) {
    const brand = required(args.brand, 'brand');
    const count = bounded(args.limit, 60, 120);
    const html = await new AutohomeClient(context).text(
      `${BASE}/grade/carhtml/${resolveInitial(brand)}.html`,
    );
    const rows = parseSeries(html, brand, count);
    if (!rows.length) throw new Error(`No Autohome series found for "${brand}"`);
    return rows;
  },
});
export { parseSeries };
