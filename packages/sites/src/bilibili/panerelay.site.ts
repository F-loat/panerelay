import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'bilibili',
  name: 'Bilibili',
  version: '0.8.0',
  origins: ['https://api.bilibili.com', 'https://aisubtitle.hdslb.com', 'https://b23.tv'],
  bindings: [
    {
      id: 'bilibili-csrf',
      source: { kind: 'cookie', name: 'bili_jct' },
      destination: { kind: 'form', name: 'csrf' },
      requestOrigins: ['https://api.bilibili.com'],
      required: true,
    },
  ],
  description: 'Authenticated Bilibili commands using the current browser session.',
});
