import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'openfda',
  name: 'openFDA',
  version: '0.8.0',
  origins: ['https://api.fda.gov'],
  description: 'Public FDA drug label and food recall data.',
});
