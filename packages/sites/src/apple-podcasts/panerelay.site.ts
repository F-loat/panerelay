import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'apple-podcasts',
  name: 'Apple Podcasts',
  version: '0.8.0',
  origins: ['https://itunes.apple.com', 'https://rss.marketingtools.apple.com'],
  description: 'Public Apple Podcasts search, charts, and episode metadata.',
});
