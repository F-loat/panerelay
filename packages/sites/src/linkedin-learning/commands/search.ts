import { defineCommand } from '@panerelay/site-kit';
import { authors, duration, LearningClient, limit, object, pick, rating, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search LinkedIn Learning.',
  access: 'read',
  args: [
    {
      name: 'keywords',
      description: 'Search keywords.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
  ],
  output: [
    'rank',
    'type',
    'title',
    'instructor',
    'difficulty',
    'duration_sec',
    'rating',
    'rating_count',
    'viewers',
    'url',
  ],
  examples: ['panerelay linkedin-learning search "AI agent" --limit 10'],
  async run(context, args) {
    const keywords = text(args.keywords);
    if (!keywords) throw new Error('linkedin-learning keywords are required');
    const take = limit(args.limit);
    const data = await new LearningClient(context).get(
      `/learning-api/searchV2?keywords=${encodeURIComponent(keywords)}&q=keywords`,
    );
    const elements = pick(data, 'elements');
    const rows = [];
    for (const raw of Array.isArray(elements) ? elements : []) {
      const item = object(raw);
      const courseSlug = text(pick(item, 'slug'));
      if (!courseSlug) continue;
      rows.push({
        rank: rows.length + 1,
        type: text(pick(item, 'entityType')),
        title: text(pick(pick(pick(item, 'headline'), 'title'), 'text')),
        instructor: authors(pick(item, 'authors')),
        difficulty: text(pick(item, 'difficultyLevel')),
        duration_sec: duration(pick(item, 'length')),
        rating: rating(pick(item, 'rating')),
        rating_count: pick(pick(item, 'rating'), 'ratingCount') ?? '',
        viewers: pick(item, 'viewerCount') ?? '',
        url: `https://www.linkedin.com/learning/${courseSlug}`,
      });
      if (rows.length >= take) break;
    }
    if (!rows.length) throw new Error(`linkedin-learning returned no results for ${keywords}`);
    return rows;
  },
});
