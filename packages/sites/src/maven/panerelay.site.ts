import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'maven',
  name: 'Maven Central',
  version: '0.8.0',
  origins: ['https://search.maven.org'],
  description: 'Public Maven Central artifact search and version metadata.',
});
