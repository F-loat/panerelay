import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'openreview',
  name: 'OpenReview',
  version: '0.8.0',
  origins: ['https://api2.openreview.net', 'https://openreview.net'],
  description: 'Public OpenReview papers, venues, authors, and review threads.',
});
