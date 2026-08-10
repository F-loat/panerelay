import { defineCommand } from '@panerelay/site-kit';
import { PaperReviewClient, object, pick, reviewUrl, text, timeout, token } from '../client.js';

export default defineCommand({
  name: 'review',
  description: 'Fetch a PaperReview.ai review by token.',
  access: 'read',
  args: [
    {
      name: 'token',
      description: 'Review token returned by PaperReview.ai.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'timeout', description: 'Request timeout in seconds.', type: 'number', default: 30 },
  ],
  output: [
    'status',
    'title',
    'venue',
    'numericalScore',
    'hasFeedback',
    'reviewUrl',
    'summary',
    'strengths',
    'weaknesses',
  ],
  examples: ['panerelay paperreview review tok_123'],
  async run(context, args) {
    const id = token(args.token);
    const response = await new PaperReviewClient(context).request(
      `/api/review/${encodeURIComponent(id)}`,
      'GET',
      timeout(args.timeout),
    );
    if (response.status === 202)
      return [
        {
          status: 'processing',
          title: null,
          venue: null,
          numericalScore: null,
          hasFeedback: null,
          reviewUrl: reviewUrl(id),
          summary: null,
          strengths: null,
          weaknesses: null,
        },
      ];
    const body = object(response.body);
    const sections = object(pick(body, 'sections'));
    return [
      {
        status: 'ready',
        title: text(pick(body, 'title')) || null,
        venue: text(pick(body, 'venue')) || null,
        numericalScore: pick(body, 'numerical_score') ?? null,
        hasFeedback: pick(body, 'has_feedback') ?? null,
        reviewUrl: reviewUrl(id),
        summary: text(pick(sections, 'summary')) || null,
        strengths: text(pick(sections, 'strengths')) || null,
        weaknesses: text(pick(sections, 'weaknesses')) || null,
      },
    ];
  },
});
