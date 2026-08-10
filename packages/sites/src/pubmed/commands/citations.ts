import { defineCommand } from '@panerelay/site-kit';
import { bounded, choice, pmid, PubMedClient, pick, summaries, text } from '../client.js';

export default defineCommand({
  name: 'citations',
  description: 'List cited-by or reference relationships.',
  access: 'read',
  args: [
    { name: 'pmid', description: 'PubMed ID', type: 'string', required: true, positional: true },
    { name: 'direction', description: 'Citation direction', type: 'string', default: 'citedby' },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
  ],
  output: ['rank', 'pmid', 'title', 'authors', 'journal', 'year', 'article_type', 'doi', 'url'],
  examples: ['panerelay pubmed citations 37780221 --direction citedby'],
  async run(context, args) {
    const identifier = pmid(args.pmid);
    const direction = choice(args.direction, ['citedby', 'references'], 'citedby', 'direction');
    const linkname = direction === 'citedby' ? 'pubmed_pubmed_citedin' : 'pubmed_pubmed_refs';
    const body = await new PubMedClient(context).request('elink', [
      { name: 'db', value: 'pubmed' },
      { name: 'dbfrom', value: 'pubmed' },
      { name: 'id', value: identifier },
      { name: 'cmd', value: 'neighbor' },
      { name: 'linkname', value: linkname },
    ]);
    const dbs = pick(
      pick(body, 'linksets') && (pick(body, 'linksets') as unknown[])[0],
      'linksetdbs',
    );
    const links = Array.isArray(dbs) ? pick(dbs[0], 'links') : undefined;
    if (!Array.isArray(links) || !links.length)
      throw new Error(`pubmed no ${direction} links for PMID ${identifier}`);
    return summaries(new PubMedClient(context), links.slice(0, bounded(args.limit)).map(text));
  },
});
