import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'ctrip',
  name: 'Ctrip',
  version: '0.8.0',
  origins: [
    'https://hotels.ctrip.com',
    'https://m.ctrip.com',
    'https://trains.ctrip.com',
    'https://you.ctrip.com',
  ],
  description: 'Public Ctrip destination and hotel-context suggestions.',
});
