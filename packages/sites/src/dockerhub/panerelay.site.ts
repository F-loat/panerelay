import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'dockerhub',
  name: 'Docker Hub',
  version: '0.8.0',
  origins: ['https://hub.docker.com'],
  description: 'Public Docker Hub repository metadata and search.',
});
