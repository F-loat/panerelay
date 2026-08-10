import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'instagram',
  name: 'Instagram',
  version: '0.8.0',
  origins: ['https://www.instagram.com'],
  bindings: [
    {
      id: 'instagram-csrf',
      source: { kind: 'cookie', name: 'csrftoken', transform: 'url-decode' },
      destination: { kind: 'header', name: 'x-csrftoken' },
      requestOrigins: ['https://www.instagram.com'],
      required: true,
    },
  ],
  description:
    'Cookie-backed Instagram profiles, feeds, relationships, saved posts, and bounded interactions.',
});
