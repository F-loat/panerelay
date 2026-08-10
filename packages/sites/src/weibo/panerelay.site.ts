import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'weibo',
  name: 'Weibo',
  version: '0.8.0',
  origins: ['https://s.weibo.com', 'https://weibo.com'],
  bindings: [
    {
      id: 'weibo-xsrf',
      source: { kind: 'cookie', name: 'XSRF-TOKEN', transform: 'url-decode' },
      destination: { kind: 'header', name: 'x-xsrf-token' },
      requestOrigins: ['https://weibo.com'],
      required: true,
    },
  ],
  description: 'Cookie-backed Weibo profiles, timelines, search, comments, and deletion.',
});
