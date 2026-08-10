import { defineCommand, SiteError } from '@panerelay/site-kit';
import { LearningClient, limit, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'trending',
  description: 'List personalized LinkedIn Learning recommendations.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum recommendations.', type: 'number', default: 10 }],
  output: ['rank', 'group', 'type', 'title', 'difficulty', 'viewers', 'url'],
  examples: ['panerelay linkedin-learning trending --limit 10'],
  async run(context, args) {
    const take = limit(args.limit);
    const data = await new LearningClient(context).get(
      '/learning-api/feedRecommendationGroups?countPerCarousel=25&q=learner',
    );
    const groups = pick(data, 'elements');
    const rows = [];
    const seen = new Set<string>();
    for (const rawGroup of Array.isArray(groups) ? groups : []) {
      const group = object(rawGroup);
      const carousels = pick(group, 'carousels');
      for (const rawCarousel of Array.isArray(carousels) ? carousels : []) {
        const carousel = object(rawCarousel);
        const cards = pick(carousel, 'cards');
        for (const rawCard of Array.isArray(cards) ? cards : []) {
          const card = object(rawCard);
          const courseSlug = text(pick(card, 'slug'));
          if (!courseSlug || seen.has(courseSlug)) continue;
          seen.add(courseSlug);
          rows.push({
            rank: rows.length + 1,
            group: text(pick(pick(carousel, 'title'), 'text') ?? pick(carousel, 'annotation')),
            type: text(pick(card, 'entityType') ?? pick(card, 'localizedEntityName')),
            title: text(
              pick(pick(card, 'title'), 'text') ??
                pick(pick(pick(card, 'headline'), 'title'), 'text') ??
                pick(pick(card, 'headline'), 'text'),
            ),
            difficulty: text(pick(card, 'difficultyLevel')),
            viewers: pick(card, 'viewerCount') ?? '',
            url: `https://www.linkedin.com/learning/${courseSlug}`,
          });
          if (rows.length >= take) return rows;
        }
      }
    }
    if (!rows.length)
      throw new SiteError(
        'empty-result',
        'LinkedIn Learning returned no personalized recommendations',
      );
    return rows;
  },
});
