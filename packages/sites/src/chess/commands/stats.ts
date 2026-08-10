import { defineCommand } from '@panerelay/site-kit';
import { ChessClient, pick, user } from '../client.js';
const KINDS = [
  'chess_rapid',
  'chess_blitz',
  'chess_bullet',
  'chess_daily',
  'chess960_daily',
  'chess_daily_960',
];
export default defineCommand({
  name: 'stats',
  description: 'Read Chess.com player ratings and records.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Chess.com username.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['kind', 'rating_current', 'rating_best', 'wins', 'losses', 'draws'],
  examples: ['panerelay chess stats hikaru'],
  async run(context, args) {
    const body = await new ChessClient(context).get(
      `/player/${encodeURIComponent(user(args.username))}/stats`,
    );
    const rows = KINDS.map(kind => {
      const value = pick(body, kind);
      if (!value || typeof value !== 'object') return null;
      return {
        kind: kind.replace(/^chess_/, ''),
        rating_current: pick(pick(value, 'last'), 'rating') || '',
        rating_best: pick(pick(value, 'best'), 'rating') || '',
        wins: pick(pick(value, 'record'), 'win') || '',
        losses: pick(pick(value, 'record'), 'loss') || '',
        draws: pick(pick(value, 'record'), 'draw') || '',
      };
    }).filter(Boolean);
    if (!rows.length) throw new Error('chess returned no player stats');
    return rows;
  },
});
