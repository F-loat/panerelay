import type { SiteCommandContext } from '@panerelay/site-kit';
import {
  bounded,
  clean,
  DoubanClient,
  imageUrl,
  object,
  required,
  subjectId,
  text,
  type JsonObject,
} from './client.js';

type Args = Record<string, unknown>;

function blocks(html: string, className: string): string[] {
  const escaped = className
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\ /g, '[^"\']*\\s+[^"\']*');
  return [
    ...html.matchAll(
      new RegExp(
        `<div[^>]+class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)(?=<div[^>]+class=["'][^"']*${escaped}|<\\/ol>|<\\/section>|$)`,
        'gi',
      ),
    ),
  ].map(match => match[1] ?? '');
}

function firstUrl(block: string, host: string): string {
  const href = text(block.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1]);
  if (!href) return '';
  try {
    return new URL(href, host).toString();
  } catch {
    return '';
  }
}

function rating(block: string): number {
  const value = clean(
    block.match(
      /<[^>]+class=["'][^"']*(?:rating_num|rating_nums)[^"']*["'][^>]*>([\s\S]*?)<\//i,
    )?.[1],
  );
  return Number.parseFloat(value) || 0;
}

function movieRows(html: string, take: number) {
  const candidates = blocks(html, 'item');
  const seen = new Set<string>();
  const rows = [];
  for (const block of candidates) {
    const url = firstUrl(block, 'https://movie.douban.com');
    const id = url.match(/\/subject\/(\d+)/)?.[1] ?? '';
    const title =
      clean(
        block.match(/<span[^>]+class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
      ) ||
      clean(
        block.match(/<a[^>]+href=["'][^"']*\/subject\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
      );
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const info = clean(
      block.match(/<p[^>]+class=["'][^"']*pl[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
    );
    const votesText =
      clean(block.match(/<span[^>]+class=["'][^"']*inq[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) ||
      clean(block.match(/<span[^>]+class=["'][^"']*pl[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    rows.push({
      id,
      title: title.split('/')[0]?.trim(),
      rating: rating(block),
      votes: Number(votesText.replace(/\D/g, '')) || 0,
      year: info.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '',
      url,
    });
    if (rows.length >= take) break;
  }
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export async function movieHot(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 50);
  return movieRows(await new DoubanClient(context).html('https://movie.douban.com/chart'), take);
}

export async function top250(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 250, 250);
  const client = new DoubanClient(context);
  const rows: ReturnType<typeof movieRows> = [];
  for (let start = 0; start < 250 && rows.length < take; start += 25) {
    const pageRows = movieRows(
      await client.html(`https://movie.douban.com/top250?start=${start}`),
      Math.min(25, take - rows.length),
    );
    rows.push(...pageRows.map(row => ({ ...row, rank: rows.length + row.rank })));
    if (pageRows.length < 25) break;
  }
  return rows;
}

export async function bookHot(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 50);
  const html = await new DoubanClient(context).html('https://book.douban.com/chart');
  const candidates = blocks(html, 'media clearfix');
  return candidates
    .map(block => {
      const url = firstUrl(block, 'https://book.douban.com');
      const title = clean(block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
      const info = clean(
        block.match(
          /<p[^>]+class=["'][^"']*(?:subject-abstract|pl|pub)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
        )?.[1],
      );
      const parts = info.split('/').map(text).filter(Boolean);
      return {
        title,
        rating: rating(block),
        quote: [...block.matchAll(/<[^>]+class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\//gi)]
          .map(match => clean(match[1]))
          .filter(Boolean)
          .join(' / '),
        author: parts[0] ?? '',
        publisher: parts.find(part => /出版社|出版公司|Press/i.test(part)) ?? parts[2] ?? '',
        year:
          parts.find(part => /\b(?:19|20)\d{2}\b/.test(part))?.match(/\b(?:19|20)\d{2}\b/)?.[0] ??
          '',
        url,
      };
    })
    .filter(row => row.title && row.url)
    .slice(0, take)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function jsonLd(html: string): JsonObject {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1] ?? '');
      const values = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];
      const found = values.map(object).find(item => text(item.name));
      if (found) return found;
    } catch {
      continue;
    }
  }
  return {};
}

function names(value: unknown): string {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map(item => (typeof item === 'string' ? item : text(object(item).name)))
    .filter(Boolean)
    .join(', ');
}

export async function subject(context: SiteCommandContext, args: Args) {
  const id = subjectId(args.id);
  const type = text(args.type) || 'movie';
  if (!['movie', 'book'].includes(type))
    throw new Error('douban subject type must be movie or book');
  const host = type === 'book' ? 'book.douban.com' : 'movie.douban.com';
  const url = `https://${host}/subject/${id}/`;
  const html = await new DoubanClient(context).html(url);
  const data = jsonLd(html);
  const aggregate = object(data.aggregateRating);
  const title =
    text(data.name) || clean(html.match(/<h1[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  if (!title) throw new Error('douban subject was not present in the HTTP response');
  return [
    {
      id,
      type,
      title,
      original_title: text(data.alternateName),
      authors: names(data.author),
      publisher: names(data.publisher),
      publish_date: text(data.datePublished),
      isbn: text(data.isbn),
      year: text(data.datePublished).match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '',
      rating: Number(aggregate.ratingValue ?? 0) || 0,
      rating_count: Number(aggregate.ratingCount ?? aggregate.reviewCount ?? 0) || 0,
      genres: Array.isArray(data.genre) ? data.genre.join(', ') : text(data.genre),
      directors: names(data.director),
      casts: names(data.actor),
      duration: text(data.duration),
      summary: clean(data.description),
      cover: Array.isArray(data.image) ? text(data.image[0]) : text(data.image),
      url,
    },
  ];
}

type Photo = {
  index: number;
  photo_id: string;
  subject_id: string;
  title: string;
  image_url: string;
  thumb_url: string;
  detail_url: string;
  page: number;
};

async function loadPhotos(
  client: DoubanClient,
  id: string,
  type: string,
  take: number,
  target = '',
): Promise<Photo[]> {
  const photos: Photo[] = [];
  const seen = new Set<string>();
  for (let start = 0; start < 500 && photos.length < take; start += 30) {
    const gallery = `https://movie.douban.com/subject/${id}/photos?type=${encodeURIComponent(type)}${start ? `&start=${start}` : ''}`;
    const html = await client.html(gallery);
    const links = [
      ...html.matchAll(
        /<a[^>]+href=["']([^"']*\/photos\/photo\/(\d+)\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ];
    let added = 0;
    for (const match of links) {
      const photoId = text(match[2]);
      if (!photoId || seen.has(photoId)) continue;
      const inner = match[3] ?? '';
      const thumb = text(
        inner.match(/<img[^>]+(?:data-origin|data-src|src)=["']([^"']+)["']/i)?.[1],
      );
      const promoted = imageUrl(thumb);
      if (!promoted) continue;
      seen.add(photoId);
      photos.push({
        index: photos.length + 1,
        photo_id: photoId,
        subject_id: id,
        title:
          clean(inner.match(/<img[^>]+(?:alt|title)=["']([^"']*)["']/i)?.[1]) || `photo_${photoId}`,
        image_url: promoted,
        thumb_url: thumb,
        detail_url: new URL(match[1] ?? '', 'https://movie.douban.com').toString(),
        page: start / 30 + 1,
      });
      added += 1;
      if ((target && photoId === target) || photos.length >= take) break;
    }
    if ((target && photos.some(photo => photo.photo_id === target)) || added < 30) break;
  }
  return target ? photos.filter(photo => photo.photo_id === target) : photos;
}

export async function photos(context: SiteCommandContext, args: Args) {
  const id = subjectId(args.id);
  const take = bounded(args.limit, 120, 500);
  return loadPhotos(new DoubanClient(context), id, text(args.type) || 'Rb', take);
}

export async function download(context: SiteCommandContext, args: Args) {
  const id = subjectId(args.id);
  const target = text(args['photo-id']);
  const take = target ? 500 : bounded(args.limit, 120, 500);
  const client = new DoubanClient(context);
  const rows = await loadPhotos(client, id, text(args.type) || 'Rb', take, target);
  if (target && !rows.length)
    throw new Error(`douban photo ${target} was not found for subject ${id}`);
  const shouldInline = rows.length === 1;
  return Promise.all(
    rows.map(async photo => {
      const base64 = shouldInline ? await client.base64(photo.image_url, photo.detail_url) : '';
      return {
        ...photo,
        status: shouldInline ? 'inline' : 'available',
        size: base64 ? Math.floor(base64.length * 0.75) : '',
        content_base64: base64,
      };
    }),
  );
}

async function self(context: SiteCommandContext): Promise<{ uid: string; name: string }> {
  const html = await new DoubanClient(context).html('https://movie.douban.com/mine');
  const match = html.match(
    /<a[^>]+href=["'][^"']*\/people\/([^/"']+)\/?["'][^>]*>([\s\S]*?)<\/a>/i,
  );
  const uid = text(match?.[1]);
  if (!uid) throw new Error('douban requires a valid logged-in browser session');
  return { uid, name: clean(match?.[2]) };
}

export async function whoami(context: SiteCommandContext) {
  const account = await self(context);
  return [
    {
      logged_in: true,
      site: 'douban',
      user_id: account.uid,
      name: account.name,
      url: `https://www.douban.com/people/${account.uid}/`,
    },
  ];
}

async function resolvedUid(context: SiteCommandContext, value: unknown): Promise<string> {
  return text(value) || (await self(context)).uid;
}

export async function marks(context: SiteCommandContext, args: Args) {
  const status = text(args.status) || 'collect';
  if (!['collect', 'wish', 'do', 'all'].includes(status))
    throw new Error('douban marks status must be collect, wish, do, or all');
  const take = bounded(args.limit, 50, 500, true);
  const uid = await resolvedUid(context, args.uid);
  const client = new DoubanClient(context);
  const result = [];
  for (const state of status === 'all' ? ['collect', 'wish', 'do'] : [status]) {
    for (let start = 0; start < 500 && (take === 0 || result.length < take); start += 15) {
      const html = await client.html(
        `https://movie.douban.com/people/${encodeURIComponent(uid)}/${state}?start=${start}&sort=time&rating=all&filter=all&mode=grid`,
      );
      const items = blocks(html, 'item');
      let added = 0;
      for (const block of items) {
        const url = firstUrl(block, 'https://movie.douban.com');
        if (!/\/subject\/\d+/.test(url)) continue;
        const title =
          clean(block.match(/<em[^>]*>([\s\S]*?)<\/em>/i)?.[1]) ||
          clean(
            block.match(
              /<a[^>]+href=["'][^"']*\/subject\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
            )?.[1],
          );
        if (!title) continue;
        const ratingClass = block.match(/class=["'][^"']*rating(\d)-t/i)?.[1];
        const info = clean(
          block.match(/<li[^>]+class=["'][^"']*intro[^"']*["'][^>]*>([\s\S]*?)<\/li>/i)?.[1],
        );
        result.push({
          title: title.split('/')[0]?.trim(),
          year: info.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '',
          my_rating: ratingClass ? Number(ratingClass) * 2 : '',
          my_status: state,
          my_date: clean(
            block.match(/<span[^>]+class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
          ),
          my_comment: clean(
            block.match(
              /<span[^>]+class=["'][^"']*comment[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
            )?.[1],
          ),
          url,
        });
        added += 1;
        if (take > 0 && result.length >= take) break;
      }
      if (added < 15) break;
    }
  }
  return take > 0 ? result.slice(0, take) : result;
}

export async function reviews(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 200);
  const uid = await resolvedUid(context, args.uid);
  const client = new DoubanClient(context);
  const result: JsonObject[] = [];
  for (let start = 0; start < 1000 && result.length < take; start += 20) {
    const html = await client.html(
      `https://movie.douban.com/people/${encodeURIComponent(uid)}/reviews?start=${start}&sort=time`,
    );
    const items = blocks(html, 'tlst');
    let added = 0;
    for (const block of items) {
      const movie = block.match(
        /<a[^>]+href=["']([^"']*\/subject\/(\d+)[^"']*)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/i,
      );
      const review = block.match(
        /<a[^>]+href=["']([^"']*\/review(?:s)?\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!review) continue;
      let content = clean(
        block.match(/<[^>]+class=["'][^"']*review-short[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      );
      const url = new URL(review[1] ?? '', 'https://movie.douban.com').toString();
      if (args.full === true || text(args.full) === 'true') {
        const detail = await client.html(url);
        content =
          clean(
            detail.match(
              /<[^>]+class=["'][^"']*review-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
            )?.[1],
          ) || content;
      }
      const star = block.match(/class=["'][^"']*allstar(\d)0/i)?.[1];
      result.push({
        movie_title: clean(movie?.[3] || movie?.[4]),
        title: clean(review[3]),
        my_rating: star ? Number(star) * 2 : 0,
        votes:
          Number(
            clean(
              block.match(/<[^>]+class=["'][^"']*pl[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
            ).replace(/\D/g, ''),
          ) || 0,
        content,
        url,
      });
      added += 1;
      if (result.length >= take) break;
    }
    if (added < 20) break;
  }
  return result;
}

export async function search(context: SiteCommandContext, args: Args) {
  const type = text(args.type) || 'movie';
  if (!['movie', 'book', 'music'].includes(type))
    throw new Error('douban search type must be movie, book, or music');
  const keyword = required(args.keyword, 'keyword');
  const take = bounded(args.limit, 20, 50);
  const url = new URL(`https://search.douban.com/${type}/subject_search`);
  url.searchParams.set('search_text', keyword);
  if (type === 'book') url.searchParams.set('cat', '1001');
  const html = await new DoubanClient(context).html(url.toString());
  const seen = new Set<string>();
  const rows = [];
  for (const match of html.matchAll(
    /<a[^>]+href=["']([^"']*\/subject\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const id = text(match[2]);
    const title = clean(match[3]);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      rank: rows.length + 1,
      id,
      type,
      title,
      rating: 0,
      abstract: '',
      url: new URL(match[1] ?? '', 'https://search.douban.com').toString(),
    });
    if (rows.length >= take) break;
  }
  return rows;
}
