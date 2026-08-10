import { defineCommand } from '@panerelay/site-kit';
import { LearningClient, object, pick, slug, text } from '../client.js';

export default defineCommand({
  name: 'course',
  description: 'Get a LinkedIn Learning course by slug.',
  access: 'read',
  args: [
    {
      name: 'slug',
      description: 'Course slug or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'title',
    'slug',
    'description',
    'difficulty',
    'duration_sec',
    'videos_count',
    'rating',
    'rating_count',
    'released',
    'url',
  ],
  examples: ['panerelay linkedin-learning course agentic-ai-build-your-first-agentic-ai-system'],
  async run(context, args) {
    const courseSlug = slug(args.slug);
    const data = await new LearningClient(context).get(
      `/learning-api/courses?q=slug&slug=${encodeURIComponent(courseSlug)}`,
    );
    const elements = pick(data, 'elements');
    const item = Array.isArray(elements) ? object(elements[0]) : {};
    if (!text(pick(item, 'title')))
      throw new Error(`linkedin-learning course not found: ${courseSlug}`);
    const courseDuration = object(pick(item, 'duration'));
    const ratingData = object(pick(item, 'rating'));
    const activated = Number(pick(item, 'activatedAt'));
    const description = pick(item, 'description');
    return [
      {
        title: text(pick(item, 'title')),
        slug: courseSlug,
        description:
          typeof description === 'string' ? description : text(pick(description, 'text')),
        difficulty: text(pick(item, 'difficultyLevel')),
        duration_sec:
          pick(courseDuration, 'unit') === 'SECOND' ? text(pick(courseDuration, 'duration')) : '',
        videos_count: pick(item, 'videosCount') ?? '',
        rating: Number.isFinite(Number(pick(ratingData, 'averageRating')))
          ? Number(pick(ratingData, 'averageRating')).toFixed(2)
          : '',
        rating_count: pick(ratingData, 'ratingCount') ?? '',
        released: activated > 0 ? new Date(activated).toISOString().slice(0, 10) : '',
        url: `https://www.linkedin.com/learning/${courseSlug}`,
      },
    ];
  },
});
