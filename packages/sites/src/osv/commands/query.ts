import { defineCommand } from '@panerelay/site-kit';
import {
  OsvClient,
  affectedPackages,
  aliases,
  boundedLimit,
  ecosystem,
  pick,
  required,
  severity,
  text,
  trimDate,
} from '../client.js';

export default defineCommand({
  name: 'query',
  description: 'Find OSV.dev vulnerabilities affecting a package.',
  access: 'read',
  args: [
    {
      name: 'package',
      description: 'Package name',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'ecosystem', description: 'OSV ecosystem', type: 'string', required: true },
    { name: 'version', description: 'Optional package version', type: 'string' },
    { name: 'limit', description: 'Maximum vulnerabilities', type: 'number', default: 30 },
  ],
  output: [
    'rank',
    'id',
    'summary',
    'severity',
    'aliases',
    'published',
    'modified',
    'affectedPackages',
    'url',
  ],
  examples: ['panerelay osv query lodash --ecosystem npm --version 4.17.20'],
  async run(context, args) {
    const name = required(args.package, 'package');
    const eco = ecosystem(args.ecosystem);
    const take = boundedLimit(args.limit, 30);
    const payload: Record<string, unknown> = { package: { name, ecosystem: eco } };
    if (text(args.version)) payload.version = text(args.version);
    const body = await new OsvClient(context).request('/v1/query', 'POST', payload);
    const vulns = Array.isArray(body.vulns) ? body.vulns : [];
    const rows = vulns
      .slice()
      .sort((left, right) =>
        text(pick(right, 'published')).localeCompare(text(pick(left, 'published'))),
      )
      .slice(0, take);
    if (!rows.length) throw new Error(`No OSV.dev vulnerabilities found for ${eco}:${name}`);
    return rows.map((item, index) => ({
      rank: index + 1,
      id: text(pick(item, 'id')),
      summary: text(pick(item, 'summary')),
      severity: severity(item),
      aliases: aliases(item),
      published: trimDate(pick(item, 'published')),
      modified: trimDate(pick(item, 'modified')),
      affectedPackages: affectedPackages(item),
      url: `https://osv.dev/vulnerability/${text(pick(item, 'id'))}`,
    }));
  },
});
