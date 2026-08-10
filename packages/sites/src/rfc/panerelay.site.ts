import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'rfc',
  name: 'IETF RFC',
  version: '0.8.0',
  origins: ['https://datatracker.ietf.org'],
  description: 'Public IETF RFC metadata from the datatracker.',
});
