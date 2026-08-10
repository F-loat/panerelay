import { defineCommand } from '@panerelay/site-kit';
import { GuaziClient, cityCode, limit, pageUrl, text } from '../client.js';

const ENERGY = ['插电混动', '纯电动', '油电混动', '增程式', '汽油', '柴油'];

export default defineCommand({
  name: 'browse',
  description: 'List the first public SSR page of used cars for sale in a Guazi city.',
  access: 'read',
  args: [
    {
      name: 'city',
      description: 'City name or Guazi city code.',
      type: 'string',
      positional: true,
      default: 'bj',
    },
    {
      name: 'limit',
      description: 'Maximum listings from the first SSR page.',
      type: 'number',
      default: 20,
    },
  ],
  output: ['rank', 'clueId', 'title', 'price', 'downPayment', 'mileage', 'year', 'city', 'url'],
  examples: ['panerelay guazi browse bj --limit 10'],
  async run(context, args) {
    const code = cityCode(args.city);
    const take = limit(args.limit, 20, 40);
    const html = await new GuaziClient(context).html(`/${code}/`);
    const anchors = html.match(/<a[^>]+href=["']\/car-detail\/c\d+\.html["'][\s\S]*?<\/a>/g) ?? [];
    const seen = new Set<string>();
    const rows = [];
    for (const anchor of anchors) {
      const id = anchor.match(/car-detail\/c(\d+)\.html/)?.[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title = text(anchor.match(/<img[^>]+alt=["']([^"']+)["']/)?.[1]);
      if (!title) continue;
      const content = text(anchor.replace(/<[^>]+>/g, ' '));
      const price = content.match(/(\d+(?:\.\d+)?)\s*万\s*首付/)?.[1];
      const downPayment = content.match(/首付\s*(\d+(?:\.\d+)?)\s*万/)?.[1];
      const mileage = content.match(/(\d+(?:\.\d+)?万公里|\d+公里)/)?.[1];
      const year = content.match(/(\d{4})年/)?.[1];
      const city = content.match(/[｜|]\s*([^｜|]{1,8}?)\s+\d+(?:\.\d+)?\s*万\s*首付/)?.[1];
      rows.push({
        rank: rows.length + 1,
        clueId: id,
        title,
        price: price ? `${price}万` : null,
        downPayment: downPayment ? `${downPayment}万` : null,
        mileage: mileage ?? null,
        year: year ?? null,
        city: text(city) || ENERGY.find(value => content.includes(value)) || null,
        url: pageUrl(`/car-detail/c${id}.html`),
      });
      if (rows.length >= take) break;
    }
    if (!rows.length) throw new Error('guazi returned no public SSR listings');
    return rows;
  },
});
