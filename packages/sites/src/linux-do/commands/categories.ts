import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'categories',
  description: 'List Linux.do categories.',
  access: 'read',
  args: [
    {
      name: 'subcategories',
      description: 'Include subcategories.',
      type: 'boolean',
      default: false,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['name', 'slug', 'id', 'topics', 'description'],
  examples: ['panerelay linux-do categories --subcategories --limit 20'],
  async run(context, args) {
    const client = new LinuxDoClient(context);
    const limit = bounded(args.limit, 20, 100);
    const raw = pick(pick(await client.get('/categories.json'), 'category_list'), 'categories');
    if (!Array.isArray(raw)) throw new Error('linux-do categories response is malformed');
    const rows: Record<string, unknown>[] = [];
    const row = (category: Record<string, unknown>, parent = '') => ({
      name: parent ? `${parent} / ${text(pick(category, 'name'))}` : text(pick(category, 'name')),
      slug: text(pick(category, 'slug')),
      id: pick(category, 'id') ?? '',
      topics: pick(category, 'topic_count') ?? 0,
      description: text(pick(category, 'description_text')).slice(0, 80),
    });
    for (const value of raw) {
      if (rows.length >= limit) break;
      const category = object(value);
      rows.push(row(category));
      const subcategoryIds = pick(category, 'subcategory_ids');
      if (!args.subcategories || !Array.isArray(subcategoryIds) || subcategoryIds.length === 0)
        continue;
      const children = pick(
        pick(
          await client.get(
            `/categories.json?parent_category_id=${encodeURIComponent(text(pick(category, 'id')))}`,
          ),
          'category_list',
        ),
        'categories',
      );
      if (!Array.isArray(children)) continue;
      for (const child of children) {
        if (rows.length >= limit) break;
        rows.push(row(object(child), text(pick(category, 'name'))));
      }
    }
    return rows;
  },
});
