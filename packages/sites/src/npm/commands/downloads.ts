import { defineCommand } from '@panerelay/site-kit';
import { NPM_API, NpmClient, requirePackageName, text, number } from '../client.js';
const PERIODS = new Set(['last-day', 'last-week', 'last-month', 'last-year']);
function period(value: unknown): string {
  const result = String(value ?? 'last-week').trim();
  if (PERIODS.has(result)) return result;
  const match = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(result);
  if (match && new Date(match[1]!) <= new Date(match[2]!)) return result;
  throw new Error(`npm downloads period "${value}" is invalid`);
}
export default defineCommand({
  name: 'downloads',
  description: 'Get daily npm package download counts.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'npm package name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'period', description: 'Download window', type: 'string', default: 'last-week' },
  ],
  output: ['rank', 'package', 'day', 'downloads'],
  examples: ['panerelay npm downloads react --period last-week'],
  async run(context, args) {
    const name = requirePackageName(args.name);
    const window = period(args.period);
    const encoded = name.split('/').map(encodeURIComponent).join('/');
    const body = (await new NpmClient(context).json(
      `${NPM_API}/downloads/range/${window}/${encoded}`,
    )) as Record<string, unknown>;
    const days = Array.isArray(body.downloads) ? body.downloads : [];
    if (!days.length)
      throw new Error(`npm has no download stats for "${name}" in window ${window}`);
    return days.map((row, index) => {
      const item = row as Record<string, unknown>;
      return {
        rank: index + 1,
        package: text(body.package) || name,
        day: text(item.day),
        downloads: number(item.downloads),
      };
    });
  },
});
