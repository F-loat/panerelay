import { defineCommand } from '@panerelay/site-kit';
import { PypiClient, STATS_BASE, packageName, period, pick, text } from '../client.js';
export default defineCommand({
  name: 'downloads',
  description: 'Fetch public PyPI download statistics.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'PyPI package name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'period', description: 'recent or overall', type: 'string', default: 'recent' },
  ],
  output: ['rank', 'package', 'period', 'date', 'downloads'],
  examples: ['panerelay pypi downloads requests --period recent'],
  async run(context, args) {
    const name = packageName(args.name);
    const selected = period(args.period);
    const client = new PypiClient(context);
    if (selected === 'recent') {
      const body = (await client.json(
        STATS_BASE,
        `/api/packages/${encodeURIComponent(name)}/recent`,
      )) as Record<string, unknown>;
      const data = pick(body, 'data');
      if (
        !data ||
        (pick(data, 'last_day') == null &&
          pick(data, 'last_week') == null &&
          pick(data, 'last_month') == null)
      )
        throw new Error(`No recent PyPI download data for "${name}"`);
      const packageNameValue = text(pick(body, 'package')) || name;
      return [
        {
          rank: 1,
          package: packageNameValue,
          period: 'last_day',
          date: '',
          downloads: pick(data, 'last_day') == null ? null : Number(pick(data, 'last_day')),
        },
        {
          rank: 2,
          package: packageNameValue,
          period: 'last_week',
          date: '',
          downloads: pick(data, 'last_week') == null ? null : Number(pick(data, 'last_week')),
        },
        {
          rank: 3,
          package: packageNameValue,
          period: 'last_month',
          date: '',
          downloads: pick(data, 'last_month') == null ? null : Number(pick(data, 'last_month')),
        },
      ];
    }
    const body = (await client.json(
      STATS_BASE,
      `/api/packages/${encodeURIComponent(name)}/overall`,
      { mirrors: 'false' },
    )) as Record<string, unknown>;
    const rows = Array.isArray(body.data) ? body.data : [];
    if (!rows.length) throw new Error(`No overall PyPI download data for "${name}"`);
    return rows.map((row, index) => ({
      rank: index + 1,
      package: text(pick(body, 'package')) || name,
      period: 'daily',
      date: text(pick(row, 'date')),
      downloads: pick(row, 'downloads') == null ? null : Number(pick(row, 'downloads')),
    }));
  },
});
