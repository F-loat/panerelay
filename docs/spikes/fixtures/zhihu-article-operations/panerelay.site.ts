import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'zhihu-article-probe',
  name: 'Zhihu article operations probe',
  version: '0.1.0',
  description: 'Disposable private-draft CRUD probe for Zhihu Browser Fetch.',
  origins: ['https://www.zhihu.com', 'https://zhuanlan.zhihu.com'],
  bindings: [
    {
      id: 'zhihu-article-probe-xsrf',
      source: { kind: 'cookie', name: '_xsrf', transform: 'url-decode' },
      destination: { kind: 'header', name: 'x-xsrftoken' },
      requestOrigins: ['https://www.zhihu.com', 'https://zhuanlan.zhihu.com'],
      required: true,
    },
  ],
});
