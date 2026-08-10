import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'goproxy',
  name: 'Go Module Proxy',
  version: '0.8.0',
  origins: ['https://proxy.golang.org'],
  description: 'Public Go module versions and origin metadata.',
});
