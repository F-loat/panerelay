import { defineCommand } from '@panerelay/site-kit';

export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in GitHub account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'id', 'username', 'name', 'url'],
  examples: ['panerelay github whoami'],
  async run(context) {
    const response = await context.fetch({
      url: 'https://github.com/settings/profile',
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: true,
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'text'
    )
      throw new Error('github requires a valid logged-in browser session');
    const html = String(response.body);
    const meta = (name: string) =>
      html.match(
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
      )?.[1] ??
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'),
      )?.[1] ??
      '';
    const username = meta('octolytics-actor-login');
    const id = meta('octolytics-actor-id');
    const name =
      html.match(/<input[^>]+id=["']user_profile_name["'][^>]+value=["']([^"']*)["']/i)?.[1] ??
      html.match(/<input[^>]+value=["']([^"']*)["'][^>]+id=["']user_profile_name["']/i)?.[1] ??
      '';
    if (!username || /\/login(?:\?|["'])/i.test(html.slice(0, 10_000)))
      throw new Error('github requires a valid logged-in browser session');
    return [
      {
        logged_in: true,
        site: 'github',
        id,
        username,
        name,
        url: `https://github.com/${username}`,
      },
    ];
  },
});
