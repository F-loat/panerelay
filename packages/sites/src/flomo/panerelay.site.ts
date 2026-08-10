import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'flomo',
  name: 'Flomo',
  version: '0.8.0',
  origins: ['https://flomoapp.com', 'https://v.flomoapp.com'],
  bindings: [
    {
      id: 'flomo-access-token',
      source: {
        kind: 'local-storage',
        origin: 'https://v.flomoapp.com',
        key: 'me',
        jsonPointers: ['/access_token', '/data/access_token'],
        trim: true,
      },
      destination: { kind: 'header', name: 'Authorization', prefix: 'Bearer ' },
      requestOrigins: ['https://flomoapp.com'],
      required: true,
    },
  ],
  description: 'Authenticated Flomo memo listing through exact-origin browser localStorage.',
});
