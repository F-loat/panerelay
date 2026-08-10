import { defineCommand } from '@panerelay/site-kit';
import { pick, RedditClient, text } from '../client.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the current Reddit user.',
  access: 'read',
  args: [],
  output: ['field', 'value'],
  examples: ['panerelay reddit whoami'],
  async run(context) {
    const user = await new RedditClient(context).me();
    const created = Number(pick(user, 'created_utc'));
    const link = Number(pick(user, 'link_karma'));
    const comment = Number(pick(user, 'comment_karma'));
    const total = Number(pick(user, 'total_karma'));
    const inbox = Number(pick(user, 'inbox_count'));
    return [
      { field: 'Username', value: `u/${text(pick(user, 'name'))}` },
      { field: 'ID', value: pick(user, 'id') ? `t2_${text(pick(user, 'id'))}` : null },
      { field: 'Post Karma', value: Number.isFinite(link) ? String(link) : null },
      { field: 'Comment Karma', value: Number.isFinite(comment) ? String(comment) : null },
      {
        field: 'Total Karma',
        value: Number.isFinite(total)
          ? String(total)
          : Number.isFinite(link + comment)
            ? String(link + comment)
            : null,
      },
      {
        field: 'Account Created',
        value: Number.isFinite(created)
          ? new Date(created * 1_000).toISOString().slice(0, 10)
          : null,
      },
      { field: 'Gold', value: pick(user, 'is_gold') ? 'Yes' : 'No' },
      { field: 'Mod', value: pick(user, 'is_mod') ? 'Yes' : 'No' },
      { field: 'Verified Email', value: pick(user, 'has_verified_email') ? 'Yes' : 'No' },
      { field: 'Has Mail', value: pick(user, 'has_mail') ? 'Yes' : 'No' },
      { field: 'Inbox Count', value: Number.isFinite(inbox) ? String(inbox) : null },
    ];
  },
});
