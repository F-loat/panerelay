import { defineCommand } from '@panerelay/site-kit';
import { bounded, pmid, PubMedClient, pick, summaries, text } from '../client.js';

export default defineCommand({
  name: 'related',
  description: 'Find related PubMed articles.',
  access: 'read',
  args: [
    { name: 'pmid', description: 'PubMed ID', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum results', type: 'number', default: 20 },
    { name: 'score', description: 'Include similarity scores', type: 'boolean', default: false },
  ],
  output: [
    'rank',
    'pmid',
    'title',
    'authors',
    'journal',
    'year',
    'article_type',
    'score',
    'doi',
    'url',
  ],
  examples: ['panerelay pubmed related 37780221 --score'],
  async run(context, args) {
    const identifier = pmid(args.pmid);
    const body = await new PubMedClient(context).request('elink', [
      { name: 'db', value: 'pubmed' },
      { name: 'dbfrom', value: 'pubmed' },
      { name: 'id', value: identifier },
      { name: 'cmd', value: 'neighbor_score' },
      { name: 'linkname', value: 'pubmed_pubmed' },
    ]);
    const dbs = pick(
      pick(body, 'linksets') && (pick(body, 'linksets') as unknown[])[0],
      'linksetdbs',
    );
    const links = Array.isArray(dbs) ? pick(dbs[0], 'links') : undefined;
    if (!Array.isArray(links)) throw new Error(`pubmed no related articles for PMID ${identifier}`);
    const selected = links
      .map(link => ({
        id: text(typeof link === 'string' ? link : pick(link, 'id')),
        score: typeof link === 'string' ? null : Number(pick(link, 'score')),
      }))
      .filter(link => link.id && link.id !== identifier)
      .slice(0, bounded(args.limit));
    if (!selected.length) throw new Error(`pubmed no related articles for PMID ${identifier}`);
    const rows = await summaries(
      new PubMedClient(context),
      selected.map(link => link.id),
    );
    return rows.map((row, index) => {
      const link = selected[index];
      return {
        ...row,
        score: args.score && link ? (Number.isFinite(link.score) ? link.score : null) : null,
      };
    });
  },
});
