import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'hackernews',
  name: 'Hacker News',
  version: '0.8.0',
  origins: ['https://hacker-news.firebaseio.com', 'https://hn.algolia.com'],
  description: 'Public Hacker News story and user commands.',
});
