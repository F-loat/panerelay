import { defineCommand } from '@panerelay/site-kit';
import { PaperReviewClient, pick, text, timeout, token } from '../client.js';

function yesNo(value: unknown, name: string): boolean {
  const result = text(value).toLowerCase();
  if (result === 'yes') return true;
  if (result === 'no') return false;
  throw new Error(`paperreview ${name} must be yes or no`);
}

export default defineCommand({
  name: 'feedback',
  description: 'Submit feedback for a completed PaperReview.ai review token.',
  access: 'write',
  args: [
    {
      name: 'token',
      description: 'Review token returned by PaperReview.ai.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'helpfulness',
      description: 'Helpfulness score from 1 to 5.',
      type: 'number',
      required: true,
    },
    { name: 'critical-error', description: 'yes or no.', type: 'string', required: true },
    { name: 'actionable-suggestions', description: 'yes or no.', type: 'string', required: true },
    { name: 'additional-comments', description: 'Optional feedback text.', type: 'string' },
    { name: 'timeout', description: 'Request timeout in seconds.', type: 'number', default: 30 },
  ],
  output: ['status', 'token', 'helpfulness', 'criticalError', 'actionableSuggestions', 'message'],
  examples: [
    'panerelay paperreview feedback tok_123 --helpfulness 4 --critical-error no --actionable-suggestions yes',
  ],
  async run(context, args) {
    const id = token(args.token);
    const helpfulness = Number(args.helpfulness);
    if (!Number.isInteger(helpfulness) || helpfulness < 1 || helpfulness > 5)
      throw new Error('paperreview helpfulness must be an integer from 1 to 5');
    const criticalError = yesNo(args['critical-error'], 'critical-error');
    const actionableSuggestions = yesNo(args['actionable-suggestions'], 'actionable-suggestions');
    const comments = text(args['additional-comments']);
    const response = await new PaperReviewClient(context).request(
      `/api/feedback/${encodeURIComponent(id)}`,
      'POST',
      timeout(args.timeout),
      {
        helpfulness,
        has_critical_error: criticalError,
        has_actionable_suggestions: actionableSuggestions,
        ...(comments ? { additional_comments: comments } : {}),
      },
    );
    return [
      {
        status: 'submitted',
        token: id,
        helpfulness,
        criticalError,
        actionableSuggestions,
        message: text(pick(response.body, 'message')) || 'Feedback submitted.',
      },
    ];
  },
});
