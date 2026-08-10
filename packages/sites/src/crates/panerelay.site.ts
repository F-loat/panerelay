import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'crates',
  name: 'crates.io',
  version: '0.8.0',
  origins: ['https://crates.io'],
  description: 'Public Rust crate registry metadata and search.',
});
