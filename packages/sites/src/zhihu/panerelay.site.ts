import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'zhihu',
  name: 'Zhihu',
  version: '0.8.0',
  origins: ['https://www.zhihu.com'],
  bindings: [
    {
      id: 'zhihu-xsrf',
      source: { kind: 'cookie', name: '_xsrf', transform: 'url-decode' },
      destination: { kind: 'header', name: 'x-xsrftoken' },
      requestOrigins: ['https://www.zhihu.com'],
      required: false,
    },
  ],
  description: 'Cookie-backed Zhihu content, profiles, collections, and interactions.',
});
