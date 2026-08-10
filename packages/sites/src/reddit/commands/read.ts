import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  media,
  object,
  pick,
  postId,
  RedditClient,
  text,
  type Value,
  writeErrors,
} from '../client.js';

function childThings(value: unknown): Value[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function repliesOf(data: Value): Value[] {
  return childThings(pick(pick(pick(data, 'replies'), 'data'), 'children'));
}

function collectArrays(children: Value[], parent: string, output: Map<string, Value[]>): void {
  output.set(parent, children);
  for (const thing of children) {
    if (pick(thing, 'kind') !== 't1') continue;
    const data = object(pick(thing, 'data'));
    const nested = repliesOf(data);
    if (!nested.length) continue;
    const name = text(pick(data, 'name')) || `t1_${text(pick(data, 'id'))}`;
    output.set(name, nested);
    collectArrays(nested, name, output);
  }
}

async function expandMore(
  client: RedditClient,
  children: Value[],
  linkId: string,
  sort: string,
  rounds: number,
): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    const parents = new Map<string, Value[]>();
    collectArrays(children, linkId, parents);
    const ids = [...parents.values()]
      .flatMap(items =>
        items
          .filter(item => pick(item, 'kind') === 'more')
          .flatMap(item => {
            const raw = pick(pick(item, 'data'), 'children');
            return Array.isArray(raw) ? raw.map(text) : [];
          }),
      )
      .filter(Boolean);
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const fetched: Value[] = [];
    for (let offset = 0; offset < unique.length; offset += 100) {
      const payload = await client.post(
        '/api/morechildren',
        {
          api_type: 'json',
          link_id: linkId,
          children: unique.slice(offset, offset + 100).join(','),
          sort,
          raw_json: '1',
        },
        true,
      );
      const errors = writeErrors(payload);
      if (errors) throw new Error(`reddit rejected more-comments expansion: ${errors}`);
      const things = pick(pick(pick(payload, 'json'), 'data'), 'things');
      if (!Array.isArray(things)) throw new Error('reddit more-comments response is malformed');
      fetched.push(...things.map(object));
    }
    for (const items of parents.values()) {
      for (let index = items.length - 1; index >= 0; index -= 1)
        if (pick(items[index], 'kind') === 'more') items.splice(index, 1);
    }
    let inserted = 0;
    for (const thing of fetched) {
      const data = object(pick(thing, 'data'));
      const parent = text(pick(data, 'parent_id'));
      const host = parents.get(parent);
      if (!host) continue;
      const name = text(pick(data, 'name'));
      if (name && host.some(item => text(pick(pick(item, 'data'), 'name')) === name)) continue;
      host.push(thing);
      inserted += 1;
    }
    if (!inserted) return;
  }
}

export default defineCommand({
  name: 'read',
  description: 'Read a Reddit post and its threaded comments.',
  access: 'read',
  args: [
    {
      name: 'post-id',
      description: 'Post ID, fullname, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'sort', description: 'Comment sort.', type: 'string', default: 'best' },
    { name: 'limit', description: 'Maximum top-level comments.', type: 'number', default: 25 },
    { name: 'depth', description: 'Maximum reply depth.', type: 'number', default: 2 },
    { name: 'replies', description: 'Maximum replies at each level.', type: 'number', default: 5 },
    {
      name: 'max-length',
      description: 'Maximum characters per body.',
      type: 'number',
      default: 2000,
    },
    {
      name: 'expand-more',
      description: 'Fetch Reddit more-comment stubs.',
      type: 'boolean',
      default: false,
    },
    { name: 'expand-rounds', description: 'Maximum expansion passes.', type: 'number', default: 2 },
  ],
  output: [
    'type',
    'author',
    'score',
    'text',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit read 1abc123 --depth 2 --expand-more'],
  async run(context, args) {
    const id = postId(args['post-id']);
    const sort = text(args.sort) || 'best';
    if (!['best', 'top', 'new', 'controversial', 'old', 'qa'].includes(sort))
      throw new Error('reddit comment sort is invalid');
    const limit = bounded(args.limit, 25, 100);
    const depth = bounded(args.depth, 2, 20);
    const replies = bounded(args.replies, 5, 100);
    const maxLength = Number(args['max-length'] ?? 2_000);
    if (!Number.isInteger(maxLength) || maxLength < 100 || maxLength > 100_000)
      throw new Error('reddit max-length must be an integer between 100 and 100000');
    const rounds = bounded(args['expand-rounds'], 2, 5);
    const client = new RedditClient(context);
    const apiLimit = Math.max(limit * 3, 100);
    const payload = await client.get(
      `/comments/${id}.json?sort=${encodeURIComponent(sort)}&limit=${apiLimit}&depth=${depth + 1}&raw_json=1`,
    );
    if (!Array.isArray(payload) || payload.length < 2)
      throw new Error('reddit comments response is malformed');
    const post = childThings(pick(pick(payload[0], 'data'), 'children')).map(item =>
      object(pick(item, 'data')),
    )[0];
    if (!post) throw new Error(`reddit post is unavailable: ${id}`);
    const top = childThings(pick(pick(payload[1], 'data'), 'children'));
    if (args['expand-more']) await expandMore(client, top, `t3_${id}`, sort, rounds);

    const output: Record<string, unknown>[] = [];
    const body = text(pick(post, 'selftext'));
    const shortenedBody =
      body.length > maxLength ? `${body.slice(0, maxLength)}\n... [truncated]` : body;
    const destination = text(pick(post, 'url'));
    output.push({
      type: 'POST',
      author: text(pick(post, 'author')) || '[deleted]',
      score: pick(post, 'score') ?? 0,
      text: `${text(pick(post, 'title'))}${shortenedBody ? `\n\n${shortenedBody}` : ''}${destination && !pick(post, 'is_self') ? `\n${destination}` : ''}`,
      ...media(post),
    });

    const walk = (thing: Value, level: number) => {
      if (pick(thing, 'kind') !== 't1') return;
      const data = object(pick(thing, 'data'));
      const rawBody = text(pick(data, 'body'));
      const shortBody = rawBody.length > maxLength ? `${rawBody.slice(0, maxLength)}...` : rawBody;
      const prefix = level === 0 ? '' : `${'  '.repeat(level)}> `;
      output.push({
        type: level === 0 ? 'L0' : `L${level}`,
        author: text(pick(data, 'author')) || '[deleted]',
        score: pick(data, 'score') ?? 0,
        text:
          level === 0
            ? shortBody
            : shortBody
                .split('\n')
                .map(line => `${prefix}${line}`)
                .join('\n'),
        post_hint: '',
        url_overridden_by_dest: '',
        preview_image_url: '',
        gallery_urls: [],
      });
      const children = repliesOf(data);
      const comments = children
        .filter(item => pick(item, 'kind') === 't1')
        .sort(
          (left, right) =>
            Number(pick(pick(right, 'data'), 'score') ?? 0) -
            Number(pick(pick(left, 'data'), 'score') ?? 0),
        );
      const more = children
        .filter(item => pick(item, 'kind') === 'more')
        .reduce((total, item) => total + Number(pick(pick(item, 'data'), 'count') ?? 0), 0);
      if (level + 1 < depth) for (const child of comments.slice(0, replies)) walk(child, level + 1);
      const hidden =
        level + 1 >= depth ? comments.length + more : Math.max(0, comments.length - replies) + more;
      if (hidden)
        output.push({
          type: `L${level + 1}`,
          author: '',
          score: '',
          text: `${'  '.repeat(level + 1)}[+${hidden} more replies]`,
          post_hint: '',
          url_overridden_by_dest: '',
          preview_image_url: '',
          gallery_urls: [],
        });
    };
    const topComments = top.filter(item => pick(item, 'kind') === 't1');
    for (const comment of topComments.slice(0, limit)) walk(comment, 0);
    const topMore = top
      .filter(item => pick(item, 'kind') === 'more')
      .reduce((total, item) => total + Number(pick(pick(item, 'data'), 'count') ?? 0), 0);
    const hiddenTop = Math.max(0, topComments.length - limit) + topMore;
    if (hiddenTop)
      output.push({
        type: '',
        author: '',
        score: '',
        text: `[+${hiddenTop} more top-level comments]`,
        post_hint: '',
        url_overridden_by_dest: '',
        preview_image_url: '',
        gallery_urls: [],
      });
    return output;
  },
});
