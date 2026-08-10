import { defineCommand } from '@panerelay/site-kit';
import { object, pick, RedditClient, subredditName, text } from '../client.js';

export default defineCommand({
  name: 'subreddit-info',
  description: 'Show metadata for a subreddit.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'Subreddit name.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay reddit subreddit-info python'],
  async run(context, args) {
    const name = subredditName(args.name, true);
    const info = object(
      pick(
        await new RedditClient(context).get(`/r/${encodeURIComponent(name)}/about.json?raw_json=1`),
        'data',
      ),
    );
    if (!text(pick(info, 'display_name')))
      throw new Error(`reddit subreddit is unavailable: ${name}`);
    const created = Number(pick(info, 'created_utc'));
    const active = pick(info, 'active_user_count') ?? pick(info, 'accounts_active');
    return [
      { field: 'Name', value: text(pick(info, 'display_name_prefixed')) || `r/${name}` },
      { field: 'Title', value: pick(info, 'title') ?? null },
      {
        field: 'Subscribers',
        value: pick(info, 'subscribers') == null ? null : text(pick(info, 'subscribers')),
      },
      { field: 'Active Now', value: active == null ? null : text(active) },
      { field: 'NSFW', value: pick(info, 'over18') ? 'Yes' : 'No' },
      { field: 'Type', value: pick(info, 'subreddit_type') ?? null },
      { field: 'Description', value: text(pick(info, 'public_description')) || null },
      {
        field: 'Created',
        value: Number.isFinite(created)
          ? new Date(created * 1_000).toISOString().slice(0, 10)
          : null,
      },
      {
        field: 'URL',
        value: pick(info, 'url') ? `https://www.reddit.com${text(pick(info, 'url'))}` : null,
      },
    ];
  },
});
