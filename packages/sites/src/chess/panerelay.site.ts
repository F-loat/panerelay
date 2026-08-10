import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'chess',
  name: 'Chess.com',
  version: '0.8.0',
  origins: ['https://api.chess.com', 'https://www.chess.com'],
  description: 'Public Chess.com player statistics and game archives.',
});
