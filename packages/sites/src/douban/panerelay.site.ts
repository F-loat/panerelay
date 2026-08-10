import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'douban',
  name: 'Douban',
  version: '0.8.0',
  origins: [
    'https://book.douban.com',
    'https://movie.douban.com',
    'https://search.douban.com',
    'https://www.douban.com',
  ],
  description:
    'Cookie-backed Douban charts, subjects, photos, personal exports, and simple downloads.',
});
