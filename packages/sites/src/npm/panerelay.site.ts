import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'npm',
  name: 'npm',
  version: '0.8.0',
  origins: ['https://api.npmjs.org', 'https://registry.npmjs.org'],
  description: 'Public npm package metadata, downloads, and registry search.',
});
