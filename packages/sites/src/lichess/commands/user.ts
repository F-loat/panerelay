import { defineCommand } from '@panerelay/site-kit';
import { BASE, LichessClient, pick, text, timestamp, username } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'Fetch a public Lichess player profile.',
  access: 'read',
  args: [{ name: 'username', description: 'Lichess username', type: 'string', required: true }],
  output: [
    'username',
    'id',
    'title',
    'patron',
    'online',
    'tosViolation',
    'createdAt',
    'seenAt',
    'gamesAll',
    'gamesWin',
    'gamesLoss',
    'gamesDraw',
    'topPerfName',
    'topPerfRating',
    'topPerfGames',
    'fideRating',
    'country',
    'bio',
    'url',
  ],
  examples: ['panerelay lichess user DrNykterstein'],
  async run(context, args) {
    const requested = username(args.username);
    const body = await new LichessClient(context).get(`/api/user/${encodeURIComponent(requested)}`);
    if (!body || pick(body, 'disabled') === true)
      throw new Error(`lichess user not found or disabled: ${requested}`);
    const perfs = pick(body, 'perfs');
    let topPerfName: string | null = null;
    let topPerfRating: number | null = null;
    let topPerfGames: number | null = null;
    if (perfs && typeof perfs === 'object')
      for (const [name, value] of Object.entries(perfs as Record<string, unknown>)) {
        if (
          ['puzzle', 'storm', 'racer', 'streak'].includes(name) ||
          !value ||
          typeof value !== 'object'
        )
          continue;
        const games = Number(pick(value, 'games')) || 0;
        if (topPerfGames == null || games > topPerfGames) {
          topPerfName = name;
          topPerfGames = games;
          topPerfRating = Number(pick(value, 'rating')) || null;
        }
      }
    const count = pick(body, 'count');
    const profile = pick(body, 'profile');
    const handle = text(pick(body, 'username')) || requested;
    return [
      {
        username: handle,
        id: text(pick(body, 'id')) || null,
        title: text(pick(body, 'title')) || null,
        patron: pick(body, 'patron') === true,
        online: pick(body, 'online') === true,
        tosViolation: pick(body, 'tosViolation') === true,
        createdAt: timestamp(pick(body, 'createdAt')),
        seenAt: timestamp(pick(body, 'seenAt')),
        gamesAll: Number(pick(count, 'all')) || null,
        gamesWin: Number(pick(count, 'win')) || null,
        gamesLoss: Number(pick(count, 'loss')) || null,
        gamesDraw: Number(pick(count, 'draw')) || null,
        topPerfName,
        topPerfRating,
        topPerfGames,
        fideRating: Number(pick(profile, 'fideRating')) || null,
        country: text(pick(profile, 'country')) || null,
        bio: text(pick(profile, 'bio')) || null,
        url: `${BASE}/@/${encodeURIComponent(handle)}`,
      },
    ];
  },
});
