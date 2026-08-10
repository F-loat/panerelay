import { defineCommand } from '@panerelay/site-kit';
import { GuaziClient, clueId, pageUrl, text } from '../client.js';

export default defineCommand({
  name: 'car',
  description: 'Show details for one public Guazi used-car listing.',
  access: 'read',
  args: [
    {
      name: 'clue-id',
      description: 'Numeric clue ID or Guazi car-detail URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay guazi car 123456789'],
  async run(context, args) {
    const id = clueId(args['clue-id']);
    const html = (await new GuaziClient(context).html(`/car-detail/c${id}.html`)).replace(
      /\\"/g,
      '"',
    );
    const rawTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/)?.[1] ??
      html.match(/"title":"([^"]{6,80})"/)?.[1] ??
      '';
    const title = text(rawTitle)
      .replace(/^【[^】]*】/, '')
      .replace(/^二手/, '')
      .replace(/报价[，,].*$/, '')
      .replace(/\s*-\s*瓜子二手车.*$/, '')
      .trim();
    const tag = text(rawTitle).match(/^【([^】]+)】/)?.[1] ?? null;
    const rawPrice = html.match(/"price":(\d{4,8})/)?.[1];
    const labels: Record<string, string> = {};
    for (const match of html.matchAll(/"label":"([^"]{1,12})","value":"([^"]{1,40})"/g)) {
      if (match[1] && match[2] && !(match[1] in labels)) labels[match[1]] = text(match[2]);
    }
    const rows = [
      ['clue_id', id],
      ['title', title || null],
      ['tag', tag],
      ['price', rawPrice ? `${(Number(rawPrice) / 10_000).toFixed(2)}万` : null],
      ['reg_date', labels['首次上牌'] || null],
      ['mileage', labels['表显里程'] || null],
      ['transfers', labels['过户次数'] || null],
      ['source_city', labels['车源地'] || null],
      ['color', labels['车身颜色'] || null],
      ['engine', labels['发动机'] || null],
      ['gearbox', labels['变速箱'] || null],
      ['drivetrain', labels['驱动方式'] || null],
      ['emission', labels['排放标准'] || null],
      ['condition', text(html.match(/基础车况[^,，"<]{0,16}/)?.[0]) || null],
      ['listing_no', labels['车源编号'] || null],
      ['url', pageUrl(`/car-detail/c${id}.html`)],
    ].map(([field, value]) => ({ field, value }));
    if (!title || !rawPrice)
      throw new Error(`guazi listing ${id} was not found or has been removed`);
    return rows;
  },
});
