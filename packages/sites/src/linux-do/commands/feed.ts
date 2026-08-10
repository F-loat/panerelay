import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, object, pick, text, topicRow, topics } from '../client.js';

type Category = { id: number; name: string; slug: string; parent?: Category };

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function resolveTag(client: LinuxDoClient, input: string) {
  const raw = pick(await client.get('/tags.json'), 'tags');
  if (!Array.isArray(raw)) throw new Error('linux-do tags response is malformed');
  const wanted = normalized(input);
  const match = raw
    .map(object)
    .find(item =>
      /^\d+$/.test(input)
        ? Number(pick(item, 'id')) === Number(input)
        : [text(pick(item, 'name')), text(pick(item, 'slug'))].some(
            value => normalized(value) === wanted,
          ),
    );
  if (!match) throw new Error(`linux-do unknown tag: ${input}`);
  return { id: Number(pick(match, 'id')), slug: text(pick(match, 'slug')) };
}

function category(value: Record<string, unknown>, parent?: Category): Category {
  return {
    id: Number(pick(value, 'id')),
    name: text(pick(value, 'name')),
    slug: text(pick(value, 'slug')),
    ...(parent ? { parent } : {}),
  };
}

async function resolveCategory(client: LinuxDoClient, input: string): Promise<Category> {
  const raw = pick(pick(await client.get('/categories.json'), 'category_list'), 'categories');
  if (!Array.isArray(raw)) throw new Error('linux-do categories response is malformed');
  const parents = raw.map(value => category(object(value)));
  const wanted = normalized(input);
  const matches = (item: Category) => {
    const keys = [item.name, item.slug];
    if (item.parent)
      keys.push(
        `${item.parent.name} / ${item.name}`,
        `${item.parent.name}/${item.name}`,
        `${item.parent.name}, ${item.name}`,
      );
    return /^\d+$/.test(input)
      ? item.id === Number(input)
      : keys.some(value => normalized(value) === wanted);
  };
  const direct = parents.find(matches);
  if (direct) return direct;
  for (const parent of parents) {
    const children = pick(
      pick(await client.get(`/categories.json?parent_category_id=${parent.id}`), 'category_list'),
      'categories',
    );
    if (!Array.isArray(children)) continue;
    const match = children.map(value => category(object(value), parent)).find(matches);
    if (match) return match;
  }
  throw new Error(`linux-do unknown category: ${input}`);
}

export default defineCommand({
  name: 'feed',
  description: 'List Linux.do topics by site, tag, or category.',
  access: 'read',
  args: [
    { name: 'view', description: 'latest, hot, or top.', type: 'string', default: 'latest' },
    { name: 'tag', description: 'Tag name, slug, or ID.', type: 'string' },
    { name: 'category', description: 'Category name, slug, ID, or path.', type: 'string' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
    { name: 'order', description: 'Discourse sort order.', type: 'string', default: 'default' },
    { name: 'ascending', description: 'Sort ascending.', type: 'boolean', default: false },
    { name: 'period', description: 'Top period.', type: 'string' },
  ],
  output: ['title', 'replies', 'created', 'likes', 'views', 'url'],
  examples: ['panerelay linux-do feed --view top --period weekly --limit 20'],
  async run(context, args) {
    const client = new LinuxDoClient(context);
    const view = text(args.view) || 'latest';
    if (!['latest', 'hot', 'top'].includes(view))
      throw new Error('linux-do view must be latest, hot, or top');
    if (args.period && view !== 'top') throw new Error('linux-do period is only valid for top');
    const period = text(args.period) || 'weekly';
    if (!['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period))
      throw new Error('linux-do period is invalid');
    const limit = bounded(args.limit, 20, 100);
    const query = new URLSearchParams();
    const order = text(args.order) || 'default';
    if (order !== 'default') query.set('order', order);
    if (args.ascending) query.set('ascending', 'true');
    query.set('per_page', String(limit));
    if (view === 'top') query.set('period', period);

    const tagInput = text(args.tag);
    const categoryInput = text(args.category);
    let path: string;
    if (!tagInput && !categoryInput) {
      path = view === 'latest' ? '/latest.json' : view === 'hot' ? '/hot.json' : '/top.json';
    } else {
      const tag = tagInput ? await resolveTag(client, tagInput) : undefined;
      const selected = categoryInput ? await resolveCategory(client, categoryInput) : undefined;
      const categorySegments = selected
        ? [...(selected.parent ? [selected.parent.slug] : []), selected.slug, String(selected.id)]
            .map(encodeURIComponent)
            .join('/')
        : '';
      const tagSegment = tag ? `${encodeURIComponent(tag.slug || `${tag.id}-tag`)}/${tag.id}` : '';
      const base =
        selected && tag
          ? `/tags/c/${categorySegments}/${tagSegment}`
          : selected
            ? `/c/${categorySegments}`
            : `/tag/${tagSegment}`;
      path = `${base}${view === 'latest' ? '.json' : `/l/${view}.json`}`;
    }
    const suffix = query.toString();
    return topics(await client.get(`${path}${suffix ? `?${suffix}` : ''}`))
      .slice(0, limit)
      .map(topicRow);
  },
});
