import { responseText, SiteError, type SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://www.1point3acres.com/bbs';

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new SiteError('invalid-input', `1point3acres ${label} cannot be empty`);
  return result;
}

export function positiveInteger(
  value: unknown,
  fallback: number,
  label: string,
  minimum = 1,
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < minimum) {
    throw new SiteError(
      'invalid-input',
      `1point3acres ${label} must be an integer of at least ${minimum}`,
    );
  }
  return result;
}

export function bounded(value: unknown, fallback: number, maximum: number, label: string): number {
  const result = positiveInteger(value, fallback, label);
  if (result > maximum) {
    throw new SiteError('invalid-input', `1point3acres ${label} must be between 1 and ${maximum}`);
  }
  return result;
}

const namedEntities: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeEntities(value: unknown): string {
  return text(value)
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([\da-f]+);/gi, (_match, hexadecimal: string) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)),
    )
    .replace(
      /&(nbsp|amp|lt|gt|quot|apos);/gi,
      (match, name: string) => namedEntities[name.toLowerCase()] ?? match,
    );
}

export function stripHtml(value: unknown): string {
  return decodeEntities(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(value: string, maximum = 300): string {
  return value.length > maximum ? `${value.slice(0, maximum)}…` : value;
}

function isCloudflareChallenge(html: string): boolean {
  return (
    /<title>[^<]*(?:Just a moment|Attention Required|Checking your browser)[^<]*<\/title>/i.test(
      html,
    ) ||
    (/cf-chl-|challenge-platform/i.test(html) &&
      /Enable JavaScript and cookies to continue|Performing security verification/i.test(html))
  );
}

export class OnePointThreeAcresClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async html(path: string): Promise<string> {
    const url = new URL(path, `${BASE}/`);
    const response = await this.#context.fetch({
      url: url.toString(),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        referer: `${BASE}/`,
      },
      responseType: 'base64',
      withCookies: true,
    });
    if (response.status === 403) {
      throw new SiteError(
        'challenge-required',
        'Open 1point3acres in the selected browser and complete its Cloudflare check, then retry',
        true,
      );
    }
    if (response.status === 401) {
      throw new SiteError('auth-required', '1point3acres requires a signed-in browser session');
    }
    if (response.status === 429) {
      throw new SiteError('upstream-failure', '1point3acres is rate limiting requests', true);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new SiteError(
        'upstream-failure',
        `1point3acres request failed with HTTP ${response.status}`,
      );
    }
    const html = responseText(response, 'gbk');
    if (isCloudflareChallenge(html)) {
      throw new SiteError(
        'challenge-required',
        'Open 1point3acres in the selected browser and complete its Cloudflare check, then retry',
        true,
      );
    }
    return html;
  }
}

interface ThreadBlock {
  kind: string;
  tid: string;
  inner: string;
}

export interface ThreadRow {
  tid: string;
  kind: string;
  title: string;
  author: string;
  forum: string;
  fid: string;
  replies: number;
  views: number;
  postTime: string;
  lastReplyUser: string;
  lastReplyTime: string;
  url: string;
}

export function parseThreadBlocks(html: string): ThreadBlock[] {
  return [
    ...html.matchAll(/<tbody id="(normalthread|stickthread)_(\d+)"[^>]*>([\s\S]*?)<\/tbody>/g),
  ].map(match => ({ kind: match[1] ?? '', tid: match[2] ?? '', inner: match[3] ?? '' }));
}

function cite(block: string): string {
  return decodeEntities(block.match(/<cite[^>]*>([\s\S]*?)<\/cite>/)?.[1]?.replace(/<[^>]+>/g, ''));
}

function time(block: string): string {
  return decodeEntities(
    block.match(/<span [^>]*title="([^"]+)"[^>]*>/)?.[1] ??
      block.match(/<em>[\s\S]*?<a [^>]*>\s*([^<]+?)\s*<\/a>/)?.[1] ??
      block.match(/<em>[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/)?.[1] ??
      block.match(/<em>\s*([^<]+?)\s*<\/em>/)?.[1],
  );
}

export function parseThreadList(html: string): ThreadRow[] {
  return parseThreadBlocks(html)
    .map(({ kind, tid, inner }) => {
      const titleMatches = [
        ...inner.matchAll(/<a [^>]*class="[^"]*\bxst\b[^"]*"[^>]*>([^<]+)<\/a>/g),
      ];
      const title = decodeEntities(titleMatches.at(-1)?.[1]);
      const forumMatch = inner.match(
        /<a href="forum-(\d+)-1\.html"[^>]*target="_blank"[^>]*>([^<]+)<\/a>/,
      );
      const byBlocks = [...inner.matchAll(/<td class="by"[^>]*>([\s\S]*?)<\/td>/g)]
        .map(match => match[1] ?? '')
        .filter(block => /<cite/.test(block));
      const authorBlock = byBlocks[0] ?? '';
      const lastBlock = byBlocks.at(-1) ?? '';
      const numbers = inner.match(
        /<td class="num"[^>]*>\s*<a[^>]*class="xi2"[^>]*>(\d+)<\/a>(?:\s*<em>(\d+)<\/em>)?/,
      );
      return {
        tid,
        kind,
        title,
        author: cite(authorBlock),
        forum: decodeEntities(forumMatch?.[2]),
        fid: forumMatch?.[1] ?? '',
        replies: Number(numbers?.[1] ?? 0),
        views: Number(numbers?.[2] ?? 0),
        postTime: time(authorBlock),
        lastReplyUser: lastBlock && lastBlock !== authorBlock ? cite(lastBlock) : '',
        lastReplyTime: lastBlock && lastBlock !== authorBlock ? time(lastBlock) : '',
        url: `${BASE}/thread-${tid}-1-1.html`,
      };
    })
    .filter(row => row.title);
}
