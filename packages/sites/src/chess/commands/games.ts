import { defineCommand } from '@panerelay/site-kit';
import { ChessClient, bounded, date, pick, text, user } from '../client.js';
export default defineCommand({
  name: 'games',
  description: 'List recent Chess.com games for a player.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Chess.com username.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum games (1-100).', type: 'number', default: 10 },
  ],
  output: [
    'date',
    'time_class',
    'rated',
    'my_color',
    'my_rating',
    'my_result',
    'opponent',
    'opponent_rating',
    'eco',
    'url',
  ],
  examples: ['panerelay chess games hikaru --limit 5'],
  async run(context, args) {
    const name = user(args.username);
    const limit = bounded(args.limit, 10);
    const archive = await new ChessClient(context).get(
      `/player/${encodeURIComponent(name)}/games/archives`,
    );
    const urls = Array.isArray(pick(archive, 'archives'))
      ? (pick(archive, 'archives') as unknown[]).slice().reverse()
      : [];
    const rows: Record<string, unknown>[] = [];
    for (const url of urls.slice(0, 6)) {
      const monthly = await new ChessClient(context).get(text(url));
      const games = Array.isArray(pick(monthly, 'games'))
        ? (pick(monthly, 'games') as unknown[]).slice().reverse()
        : [];
      for (const game of games) {
        const white = pick(game, 'white');
        const black = pick(game, 'black');
        const whiteName = text(pick(white, 'username'));
        const blackName = text(pick(black, 'username'));
        const isWhite = whiteName.toLowerCase() === name;
        const me = isWhite ? white : black;
        const opponent = isWhite ? black : white;
        if (!whiteName || !blackName || (!isWhite && blackName.toLowerCase() !== name)) continue;
        rows.push({
          date: date(pick(game, 'end_time')),
          time_class: text(pick(game, 'time_class')),
          rated: pick(game, 'rated') === true,
          my_color: isWhite ? 'white' : 'black',
          my_rating: pick(me, 'rating') || '',
          my_result: text(pick(me, 'result')),
          opponent: text(pick(opponent, 'username')),
          opponent_rating: pick(opponent, 'rating') || '',
          eco: text(pick(game, 'eco')),
          url: text(pick(game, 'url')),
        });
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }
    if (!rows.length) throw new Error(`chess returned no recent games for ${name}`);
    return rows;
  },
});
