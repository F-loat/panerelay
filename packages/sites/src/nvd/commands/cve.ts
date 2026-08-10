import { defineCommand } from '@panerelay/site-kit';
import { cveId, cwes, englishDescription, NvdClient, pick, primaryCvss, text } from '../client.js';

export default defineCommand({
  name: 'cve',
  description: 'Fetch NIST NVD CVE detail.',
  access: 'read',
  args: [
    { name: 'id', description: 'CVE identifier', type: 'string', required: true, positional: true },
  ],
  output: [
    'id',
    'published',
    'lastModified',
    'vulnStatus',
    'baseScore',
    'severity',
    'attackVector',
    'cwe',
    'kevAdded',
    'description',
    'url',
  ],
  examples: ['panerelay nvd cve CVE-2021-44228'],
  async run(context, args) {
    const id = cveId(args.id);
    const body = await new NvdClient(context).json({ cveId: id });
    const rows = pick(body, 'vulnerabilities');
    const cve = Array.isArray(rows) ? pick(rows[0], 'cve') : undefined;
    if (!pick(cve, 'id')) throw new Error(`NVD has no record for "${id}"`);
    const metric = primaryCvss(pick(cve, 'metrics'));
    const data = pick(metric, 'cvssData');
    const canonical = text(pick(cve, 'id'));
    return [
      {
        id: canonical,
        published: text(pick(cve, 'published')).slice(0, 10),
        lastModified: text(pick(cve, 'lastModified')).slice(0, 10),
        vulnStatus: text(pick(cve, 'vulnStatus')),
        baseScore: typeof pick(data, 'baseScore') === 'number' ? pick(data, 'baseScore') : null,
        severity: text(pick(data, 'baseSeverity')) || text(pick(metric, 'baseSeverity')),
        attackVector: text(pick(data, 'attackVector')),
        cwe: cwes(pick(cve, 'weaknesses')),
        kevAdded: text(pick(cve, 'cisaExploitAdd')).slice(0, 10),
        description: englishDescription(pick(cve, 'descriptions')),
        url: `https://nvd.nist.gov/vuln/detail/${canonical}`,
      },
    ];
  },
});
