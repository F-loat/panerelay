import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'maimai',
  name: 'Maimai',
  version: '0.8.0',
  origins: ['https://maimai.cn'],
  bindings: [
    {
      id: 'maimai-csrf',
      source: { kind: 'cookie', name: 'csrftoken', transform: 'url-decode' },
      destination: { kind: 'header', name: 'x-csrf-token' },
      requestOrigins: ['https://maimai.cn'],
      required: true,
    },
  ],
  description: 'Cookie-backed Maimai account identity and recruiter talent search.',
});
