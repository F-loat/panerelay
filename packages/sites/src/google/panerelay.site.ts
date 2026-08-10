import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'google',
  name: 'Google',
  version: '0.8.0',
  origins: [
    'https://news.google.com',
    'https://suggestqueries.google.com',
    'https://trends.google.com',
  ],
  description: 'Public Google search suggestions.',
});
