import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'arxiv',
  name: 'arXiv',
  version: '0.8.0',
  origins: ['https://export.arxiv.org'],
  description: 'Public arXiv paper search and metadata commands.',
});
