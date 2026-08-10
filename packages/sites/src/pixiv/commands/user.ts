import { defineCommand } from '@panerelay/site-kit';
import { numericId, object, pick, PixivClient, text } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'Show a Pixiv artist profile.',
  access: 'read',
  args: [
    {
      name: 'uid',
      description: 'Pixiv user ID.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'user_id',
    'name',
    'premium',
    'following',
    'illusts',
    'manga',
    'novels',
    'comment',
    'url',
  ],
  examples: ['panerelay pixiv user 123456'],
  async run(context, args) {
    const uid = numericId(args.uid, 'uid');
    const body = object(await new PixivClient(context).ajax(`/ajax/user/${uid}`, { full: 1 }));
    const name = text(pick(body, 'name'));
    if (!name) throw new Error(`pixiv user not found: ${uid}`);
    const count = (value: unknown) =>
      value && typeof value === 'object'
        ? Object.keys(object(value)).length
        : Number(value ?? 0) || 0;
    return [
      {
        user_id: uid,
        name,
        premium: pick(body, 'premium') ? 'Yes' : 'No',
        following: pick(body, 'following') ?? 0,
        illusts: count(pick(body, 'illusts')),
        manga: count(pick(body, 'manga')),
        novels: count(pick(body, 'novels')),
        comment: text(pick(body, 'comment')).slice(0, 80),
        url: `https://www.pixiv.net/users/${uid}`,
      },
    ];
  },
});
