import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'archive',
  name: 'Internet Archive',
  version: '0.8.0',
  origins: ['https://archive.org', 'https://web.archive.org'],
  description: 'Public Internet Archive metadata and Wayback Machine lookups.',
});
