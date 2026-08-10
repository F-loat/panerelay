import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'bbc',
  name: 'BBC News',
  version: '0.8.0',
  origins: ['https://feeds.bbci.co.uk'],
  description: 'Public BBC News headlines and section RSS feeds.',
});
