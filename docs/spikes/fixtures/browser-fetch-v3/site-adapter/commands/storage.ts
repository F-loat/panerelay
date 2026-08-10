import { defineCommand, SiteError } from '@panerelay/site-kit';

export default defineCommand({
  name: 'storage',
  description: 'Verify exact-origin localStorage injection without returning its value.',
  access: 'read',
  args: [],
  output: ['authorized', 'redacted'],
  examples: ['panerelay browser-fetch-v3-fixture storage'],
  async run(context) {
    const response = await context.fetch({
      url: 'http://127.0.0.1:43919/storage/status',
      bindings: ['fixture-storage-token'],
      responseType: 'json',
      withCookies: false,
    });
    if (response.status !== 200 || response.bodyType !== 'json') {
      throw new SiteError(
        'upstream-failure',
        'Browser fetch v3 fixture returned an invalid response',
      );
    }
    const body =
      response.body && typeof response.body === 'object' && !Array.isArray(response.body)
        ? (response.body as Record<string, unknown>)
        : {};
    if (body.authorized !== true) {
      throw new SiteError('auth-required', 'Fixture did not receive protected browser state');
    }
    return [{ authorized: true, redacted: body.reflected === '[redacted]' }];
  },
});
