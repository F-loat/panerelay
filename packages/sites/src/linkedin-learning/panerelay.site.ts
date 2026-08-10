import { defineSite } from '@panerelay/site-kit';
export default defineSite({
  id: 'linkedin-learning',
  name: 'LinkedIn Learning',
  version: '0.8.0',
  origins: ['https://www.linkedin.com'],
  bindings: [
    {
      id: 'linkedin-learning-csrf',
      source: { kind: 'cookie', name: 'JSESSIONID' },
      destination: { kind: 'header', name: 'csrf-token' },
      requestOrigins: ['https://www.linkedin.com'],
      required: true,
    },
  ],
  description: 'Cookie-backed LinkedIn Learning search, courses, and recommendations.',
});
