import { defineCommand } from '@panerelay/site-kit';
import { OpenReviewClient, content, forumId, limit, pick, text } from '../client.js';
function sections(note: unknown): string {
  const labels: Array<[string, string]> = [
    ['summary', 'Summary'],
    ['strengths', 'Strengths'],
    ['weaknesses', 'Weaknesses'],
    ['questions', 'Questions'],
    ['comment', 'Comment'],
    ['rebuttal', 'Rebuttal'],
    ['decision', 'Decision'],
    ['recommendation', 'Recommendation'],
    ['title', 'Title'],
    ['abstract', 'Abstract'],
    ['withdrawal_confirmation', 'Withdrawal confirmation'],
  ];
  return labels
    .map(([key, label]) => {
      const value = content(note, key);
      if (value == null || value === '') return '';
      return `${label}: ${Array.isArray(value) ? value.join(', ') : text(value).replace(/\r\n/g, '\n').trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
function classify(note: unknown, root: boolean): string {
  if (root) return 'PAPER';
  const invitation = Array.isArray(pick(note, 'invitations'))
    ? ((pick(note, 'invitations') as unknown[]).map(text).find(value => /\/-\//.test(value)) ?? '')
    : '';
  const tail = invitation.split('/-/').pop()?.toLowerCase() ?? '';
  if (tail.includes('decision')) return 'DECISION';
  if (tail.includes('withdrawal')) return 'WITHDRAWAL';
  if (tail.includes('rebuttal')) return 'REBUTTAL';
  if (tail.includes('review')) return 'REVIEW';
  if (tail.includes('comment')) return 'COMMENT';
  return tail ? tail.toUpperCase() : 'NOTE';
}
function author(note: unknown): string {
  const signatures = pick(note, 'signatures');
  const value = Array.isArray(signatures) ? text(signatures[0]) : '';
  return value.startsWith('~')
    ? value.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ')
    : (value.split('/').pop() ?? value);
}
export default defineCommand({
  name: 'reviews',
  description: 'Show an OpenReview paper review thread.',
  access: 'read',
  args: [
    {
      name: 'forum',
      description: 'OpenReview forum ID',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'max-length', description: 'Per-row text truncation', type: 'number', default: 4000 },
  ],
  output: ['type', 'author', 'rating', 'confidence', 'text'],
  examples: ['panerelay openreview reviews 5sRnsubyAK'],
  async run(context, args) {
    const forum = forumId(args.forum, 'forum');
    const maxLength = limit(args['max-length'], 4000, 100000);
    if (maxLength < 200) throw new Error('openreview max-length must be at least 200');
    const client = new OpenReviewClient(context);
    const rootBody = (await client.json(`/notes?id=${encodeURIComponent(forum)}`)) as {
      notes?: unknown[];
    } | null;
    const root = rootBody?.notes?.[0];
    if (!root) throw new Error(`No OpenReview forum found with id "${forum}"`);
    const replyBody = (await client.json(
      `/notes?forum=${encodeURIComponent(forum)}&details=replies&limit=1000`,
    )) as { notes?: unknown[] } | null;
    const replies = (replyBody?.notes ?? [])
      .filter(note => text(pick(note, 'id')) !== forum)
      .sort((a, b) => Number(pick(a, 'cdate') ?? 0) - Number(pick(b, 'cdate') ?? 0));
    return [root, ...replies].map(note => {
      const value = sections(note);
      return {
        type: classify(note, note === root),
        author: author(note),
        rating: text(content(note, 'rating')),
        confidence: text(content(note, 'confidence')),
        text: value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value,
      };
    });
  },
});
