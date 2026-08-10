import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'pypi',
  name: 'PyPI',
  version: '0.8.0',
  origins: ['https://pypi.org', 'https://pypistats.org'],
  description: 'Public Python package metadata and download statistics.',
});
