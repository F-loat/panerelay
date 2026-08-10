import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'browser-fetch-v3-fixture',
  name: 'Browser fetch v3 fixture',
  version: '0.1.0',
  description: 'Local exact-origin browser fetch v3 storage probe.',
  origins: ['http://127.0.0.1:43919'],
  bindings: [
    {
      id: 'fixture-storage-token',
      source: {
        kind: 'local-storage',
        origin: 'http://127.0.0.1:43919',
        key: 'panerelay.fetch-v3.fixture',
        jsonPointers: ['/data/access_token'],
      },
      destination: { kind: 'header', name: 'Authorization', prefix: 'Bearer ' },
      requestOrigins: ['http://127.0.0.1:43919'],
      required: true,
    },
  ],
});
