import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'bluesky',
  name: 'Bluesky',
  version: '0.8.0',
  origins: ['https://public.api.bsky.app'],
  description: 'Public Bluesky social graph, feed, and profile data.',
});
