import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'nvd',
  name: 'NVD',
  version: '0.8.0',
  origins: ['https://services.nvd.nist.gov'],
  description: 'Public NIST vulnerability detail and CVSS metadata.',
});
