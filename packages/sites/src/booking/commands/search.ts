import { defineCommand, SiteError } from '@panerelay/site-kit';

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function integer(value: unknown, fallback: number, minimum: number, maximum: number, name: string) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`booking ${name} must be between ${minimum} and ${maximum}`);
  return parsed;
}
function date(value: unknown, name: string) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()))
    throw new Error(`booking ${name} must be YYYY-MM-DD`);
  return raw;
}

export default defineCommand({
  name: 'search',
  description: 'Search Booking.com hotels by destination and dates.',
  access: 'read',
  args: [
    {
      name: 'destination',
      description: 'City, district, or hotel.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'checkin', description: 'Check-in YYYY-MM-DD.', type: 'string', required: true },
    { name: 'checkout', description: 'Check-out YYYY-MM-DD.', type: 'string', required: true },
    { name: 'adults', description: 'Adults.', type: 'number', default: 2 },
    { name: 'rooms', description: 'Rooms.', type: 'number', default: 1 },
    { name: 'children', description: 'Children.', type: 'number', default: 0 },
    { name: 'currency', description: 'Three-letter currency.', type: 'string' },
    { name: 'lang', description: 'Booking language.', type: 'string' },
    { name: 'limit', description: 'Maximum hotels.', type: 'number', default: 25 },
    { name: 'offset', description: 'Result offset.', type: 'number', default: 0 },
  ],
  output: [
    'rank',
    'name',
    'country',
    'slug',
    'star_rating',
    'review_score',
    'review_count',
    'price_amount',
    'price_currency',
    'distance',
    'recommended_room',
    'url',
  ],
  examples: ['panerelay booking search Tokyo --checkin 2026-09-01 --checkout 2026-09-03'],
  async run(context, args) {
    const destination = String(args.destination ?? '').trim();
    if (!destination) throw new Error('booking destination is required');
    const checkin = date(args.checkin, 'checkin');
    const checkout = date(args.checkout, 'checkout');
    if (checkin >= checkout) throw new Error('booking checkout must be after checkin');
    const adults = integer(args.adults, 2, 1, 30, 'adults');
    const rooms = integer(args.rooms, 1, 1, 30, 'rooms');
    const children = integer(args.children, 0, 0, 10, 'children');
    const take = integer(args.limit, 25, 1, 100, 'limit');
    const offset = integer(args.offset, 0, 0, 1000, 'offset');
    const currency = String(args.currency ?? '')
      .trim()
      .toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency))
      throw new Error('booking currency must be a three-letter code');
    const lang = String(args.lang ?? '')
      .trim()
      .toLowerCase();
    if (lang && !/^[a-z]{2}(?:-[a-z]{2})?$/.test(lang)) throw new Error('booking lang is invalid');
    const file = lang ? `searchresults.${lang}.html` : 'searchresults.html';
    const url = new URL(`https://www.booking.com/${file}`);
    for (const [key, value] of Object.entries({
      ss: destination,
      checkin,
      checkout,
      group_adults: String(adults),
      no_rooms: String(rooms),
      group_children: String(children),
    }))
      url.searchParams.set(key, value);
    if (offset) url.searchParams.set('offset', String(offset));
    if (currency) url.searchParams.set('selected_currency', currency);
    const response = await context.fetch({
      url: url.toString(),
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`booking request failed: HTTP ${response.status}`);
    const html = String(response.body);
    if (
      /captcha|challenge|verify\s*you\s*are|access\s*denied|unusual\s*traffic/i.test(
        html.slice(0, 20_000),
      )
    )
      throw new SiteError('challenge-required', 'Booking returned a verification page', true);
    const starts = [...html.matchAll(/<[^>]+data-testid=["']property-card["'][^>]*>/gi)].map(
      match => match.index ?? 0,
    );
    const rows = [];
    for (let index = 0; index < starts.length && rows.length < take; index += 1) {
      const start = starts[index];
      if (start == null) continue;
      const block = html.slice(start, starts[index + 1] ?? Math.min(html.length, start + 100_000));
      const title = clean(block.match(/<[^>]+data-testid=["']title["'][^>]*>([\s\S]*?)<\//i)?.[1]);
      const link =
        block.match(/<a[^>]+data-testid=["']title-link["'][^>]+href=["']([^"']+)["']/i) ??
        block.match(/<a[^>]+href=["']([^"']+)["'][^>]+data-testid=["']title-link["']/i);
      if (!title || !link?.[1]) continue;
      let parsed: URL;
      try {
        parsed = new URL(link[1], 'https://www.booking.com');
      } catch {
        continue;
      }
      const pathMatch = parsed.pathname.match(/^\/hotel\/([a-z]{2})\/([^./]+)/i);
      const country = pathMatch?.[1] ?? '';
      const slug = pathMatch?.[2] ?? '';
      if (!country || !slug) continue;
      const review = clean(
        block.match(/<[^>]+data-testid=["']review-score["'][^>]*>([\s\S]*?)<\//i)?.[1],
      );
      const score = review.match(/(\d{1,2})\.(\d)/);
      const reviewCount = review.match(
        /([0-9][0-9,]*)\s*(?:reviews|条住客点评|条评论|レビュー|리뷰)/i,
      );
      const stars = clean(
        block.match(
          /<[^>]+data-testid=["'](?:rating-stars|quality-rating)["'][^>]*(?:aria-label=["']([^"']*)["'])?[^>]*>/i,
        )?.[1],
      ).match(/(\d)/)?.[1];
      const price = clean(
        block.match(
          /<[^>]+data-testid=["']price-and-discounted-price["'][^>]*>([\s\S]*?)<\//i,
        )?.[1],
      );
      const symbol = price.match(/(US\$|A\$|C\$|HK\$|NT\$|S\$|CN¥|CN￥|[$€£¥￥₹₩])/i)?.[1] ?? '';
      const currencies: Record<string, string> = {
        $: 'USD',
        US$: 'USD',
        A$: 'AUD',
        C$: 'CAD',
        HK$: 'HKD',
        NT$: 'TWD',
        S$: 'SGD',
        '€': 'EUR',
        '£': 'GBP',
        '¥': 'JPY',
        '￥': 'CNY',
        'CN¥': 'CNY',
        'CN￥': 'CNY',
        '₹': 'INR',
        '₩': 'KRW',
      };
      const amount = price.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0];
      rows.push({
        rank: offset + rows.length + 1,
        name: title,
        country,
        slug,
        star_rating: stars ? Number(stars) : '',
        review_score: score ? Number(`${score[1]}.${score[2]}`) : '',
        review_count: reviewCount ? Number((reviewCount[1] ?? '').replace(/,/g, '')) : '',
        price_amount: amount ? Number(amount) : '',
        price_currency: currencies[symbol] ?? currency,
        distance: clean(block.match(/<[^>]+data-testid=["']distance["'][^>]*>([\s\S]*?)<\//i)?.[1]),
        recommended_room: clean(
          block.match(/<[^>]+data-testid=["']recommended-units["'][^>]*>([\s\S]*?)<\//i)?.[1],
        ),
        url: `https://www.booking.com/hotel/${country}/${slug}.html`,
      });
    }
    return rows;
  },
});
