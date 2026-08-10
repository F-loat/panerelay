import type { SiteCommandContext } from '@panerelay/site-kit';

type Args = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function parseInput(value: unknown) {
  const raw = text(value);
  if (!raw) throw new Error('uiverse input is required');
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (!['uiverse.io', 'www.uiverse.io'].includes(url.hostname)) {
      throw new Error('uiverse input must use uiverse.io');
    }
    pathname = url.pathname;
  }
  const [username, slug, ...rest] = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
  if (!username || !slug || rest.length)
    throw new Error('uiverse input must be author/slug or a component URL');
  return { username, slug, url: `https://uiverse.io/${username}/${slug}` };
}

async function json(context: SiteCommandContext, url: string): Promise<JsonObject> {
  const response = await context.fetch({
    url,
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://uiverse.io/' },
    responseType: 'json',
    withCookies: true,
  });
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
    throw new Error(`uiverse request failed: HTTP ${response.status}`);
  }
  return object(response.body);
}

export async function code(context: SiteCommandContext, args: Args) {
  const component = parseInput(args.input);
  const target = text(args.target).toLowerCase();
  if (!['html', 'css'].includes(target)) {
    throw new Error(
      'uiverse fetch adapter supports --target html or css; React/Vue export requires the page dialog',
    );
  }
  const routeKey = 'routes/$username.$friendlyId';
  const route = await json(context, `${component.url}?_data=${encodeURIComponent(routeKey)}`);
  const post = object(route.post);
  const postId = text(post.id);
  if (!postId) throw new Error('uiverse component response did not contain a post ID');
  const codeKey = 'routes/resource.post.code.$id';
  const payload = await json(
    context,
    `https://uiverse.io/resource/post/code/${encodeURIComponent(postId)}?v=1&_data=${encodeURIComponent(codeKey)}`,
  );
  const content = text(payload[target]);
  if (!content) throw new Error(`uiverse returned no ${target} code`);
  return [
    {
      target,
      username: component.username,
      slug: component.slug,
      url: component.url,
      language: target === 'html' && post.isTailwind ? 'html+tailwind' : target,
      length: content.length,
      code: content,
      post_id: postId,
      type: text(post.type),
      is_tailwind: Boolean(post.isTailwind),
    },
  ];
}
