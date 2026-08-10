import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'pubmed',
  name: 'PubMed',
  version: '0.8.0',
  origins: ['https://eutils.ncbi.nlm.nih.gov'],
  description: 'Public PubMed literature search and article metadata.',
});
