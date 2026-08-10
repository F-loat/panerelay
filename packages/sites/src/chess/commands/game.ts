import { defineCommand } from '@panerelay/site-kit';
import { ChessClient, gameUrl, pick, scalar, text } from '../client.js';

export default defineCommand({
  name: 'game',
  description: 'Read a public Chess.com game summary by URL.',
  access: 'read',
  args: [
    {
      name: 'game-url',
      description: 'Chess.com live or daily game URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['kind', 'game_id', 'date', 'white', 'black', 'result', 'termination', 'url'],
  examples: ['panerelay chess game https://www.chess.com/game/live/168842570216'],
  async run(context, args) {
    const { kind, id } = gameUrl(args['game-url']);
    const payload = await new ChessClient(context).get(
      `https://www.chess.com/callback/${kind}/game/${id}`,
    );
    const game = pick(payload, 'game');
    if (!game || typeof game !== 'object' || Array.isArray(game))
      throw new Error('chess callback returned no game payload');
    const headers = pick(game, 'pgnHeaders');
    const players = pick(payload, 'players');
    const whitePlayer =
      pick(pick(players, 'top'), 'color') === 'white'
        ? pick(players, 'top')
        : pick(players, 'bottom');
    const blackPlayer =
      pick(pick(players, 'top'), 'color') === 'black'
        ? pick(players, 'top')
        : pick(players, 'bottom');
    const white = text(pick(whitePlayer, 'username')) || text(pick(headers, 'White'));
    const black = text(pick(blackPlayer, 'username')) || text(pick(headers, 'Black'));
    const result = text(pick(headers, 'Result'));
    if (!white || !black || !result)
      throw new Error('chess callback is missing stable game summary fields');
    return [
      {
        kind,
        game_id: id,
        date: text(pick(headers, 'Date')).replace(/\./g, '-') || dateValue(pick(game, 'endTime')),
        white,
        white_rating: scalar(pick(whitePlayer, 'rating')) || scalar(pick(headers, 'WhiteElo')),
        black,
        black_rating: scalar(pick(blackPlayer, 'rating')) || scalar(pick(headers, 'BlackElo')),
        result,
        winner_color: text(pick(game, 'colorOfWinner')),
        termination: text(pick(headers, 'Termination')) || text(pick(game, 'resultMessage')),
        eco: text(pick(headers, 'ECO')),
        time_control: text(pick(headers, 'TimeControl')),
        rated: Boolean(pick(game, 'isRated')),
        ply_count: pick(game, 'plyCount') ?? '',
        url: `https://www.chess.com/game/${kind}/${id}`,
      },
    ];
  },
});

function dateValue(value: unknown): string {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString().slice(0, 10)
    : '';
}
