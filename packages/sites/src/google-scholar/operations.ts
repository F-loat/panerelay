import type { SiteCommandContext } from '@panerelay/site-kit';
type Args = Record<string, unknown>;
function clean(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function required(value: unknown, name: string) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`google-scholar ${name} is required`);
  return result;
}
function limit(value: unknown) {
  const parsed = value == null || value === '' ? 10 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20)
    throw new Error('google-scholar limit must be between 1 and 20');
  return parsed;
}
async function html(context: SiteCommandContext, url: string) {
  const response = await context.fetch({
    url,
    headers: { accept: 'text/html' },
    responseType: 'text',
    withCookies: true,
  });
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
    throw new Error(`google-scholar request failed: HTTP ${response.status}`);
  const body = String(response.body);
  if (/unusual traffic|not a robot|captcha/i.test(body))
    throw new Error('google-scholar returned a CAPTCHA');
  return body;
}
export async function search(context: SiteCommandContext, args: Args) {
  const query = required(args.query, 'query');
  const take = limit(args.limit);
  const body = await html(
    context,
    `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=zh-CN`,
  );
  const cards = [
    ...body.matchAll(
      /<div[^>]+class=["'][^"']*\bgs_r\b[^"']*\bgs_or\b[^"']*\bgs_scl\b[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*\bgs_r\b|$)/gi,
    ),
  ];
  const rows = [];
  for (const match of cards) {
    const block = match[1] ?? '';
    const anchor = block.match(
      /<(?:h3|div)[^>]+class=["'][^"']*gs_rt[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const title = clean(anchor?.[2]);
    if (!title) continue;
    const info = clean(
      block.match(/<[^>]+class=["'][^"']*gs_a[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
    );
    const parts = info.split(' - ');
    const sourceParts = (parts[1] ?? '').split(',');
    const cited =
      clean(block.match(/<a[^>]+href=["'][^"']*cites[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]).match(
        /(\d+)/,
      )?.[1] ?? '0';
    rows.push({
      rank: rows.length + 1,
      title,
      authors: (parts[0] ?? '').slice(0, 80),
      source: (sourceParts.slice(0, -1).join(',') || sourceParts[0] || '').trim().slice(0, 60),
      year: info.match(/(?:19|20)\d{2}/)?.[0] ?? '',
      cited,
      url: String(anchor?.[1] ?? ''),
    });
    if (rows.length >= take) break;
  }
  return rows;
}
export async function profile(context: SiteCommandContext, args: Args) {
  const author = required(args.author, 'author');
  const take = limit(args.limit);
  let userId = /^[A-Za-z0-9_-]{12}$/.test(author) ? author : '';
  if (!userId) {
    const listing = await html(
      context,
      `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(author)}&hl=en`,
    );
    userId = listing.match(/href=["'][^"']*citations\?[^"']*user=([A-Za-z0-9_-]{12})/i)?.[1] ?? '';
    if (!userId) throw new Error(`google-scholar profile not found: ${author}`);
  }
  const body = await html(
    context,
    `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=en&sortby=citedby`,
  );
  const name = clean(body.match(/<[^>]+id=["']gsc_prf_in["'][^>]*>([\s\S]*?)<\//i)?.[1]);
  if (!name) throw new Error(`google-scholar profile not found: ${author}`);
  const affiliation = clean(
    body.match(/<[^>]+class=["'][^"']*gsc_prf_il[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
  );
  const stats = [
    ...body.matchAll(/<td[^>]+class=["'][^"']*gsc_rsb_std[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi),
  ].map(match => clean(match[1]));
  const rows = [
    {
      rank: 0,
      title: `${name}${affiliation ? ` (${affiliation})` : ''}`,
      cited: `h=${stats[2] ?? ''} i10=${stats[4] ?? ''} total=${stats[0] ?? ''}`,
      year: '-',
    },
  ];
  for (const match of body.matchAll(
    /<tr[^>]+class=["'][^"']*gsc_a_tr[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
  )) {
    const block = match[1] ?? '';
    const title = clean(
      block.match(/<a[^>]+class=["'][^"']*gsc_a_at[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
    );
    if (!title) continue;
    rows.push({
      rank: rows.length,
      title,
      cited:
        clean(
          block.match(/<a[^>]+class=["'][^"']*gsc_a_ac[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
        ) || '0',
      year: clean(
        block.match(/<span[^>]+class=["'][^"']*gsc_a_h[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
      ),
    });
    if (rows.length > take) break;
  }
  return rows;
}
