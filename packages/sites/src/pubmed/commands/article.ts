import { defineCommand } from '@panerelay/site-kit';
import { parseArticle, pmid, PubMedClient, text } from '../client.js';

export default defineCommand({
  name: 'article',
  description: 'Get PubMed article metadata and abstract.',
  access: 'read',
  args: [
    { name: 'pmid', description: 'PubMed ID', type: 'string', required: true, positional: true },
    {
      name: 'full-abstract',
      description: 'Return the complete abstract',
      type: 'boolean',
      default: false,
    },
  ],
  output: [
    'pmid',
    'title',
    'authors',
    'journal',
    'year',
    'date',
    'article_type',
    'language',
    'doi',
    'pmc',
    'affiliations',
    'grants',
    'mesh_terms',
    'keywords',
    'abstract',
    'url',
  ],
  examples: ['panerelay pubmed article 37780221 --full-abstract'],
  async run(context, args) {
    const identifier = pmid(args.pmid);
    const body = await new PubMedClient(context).request(
      'efetch',
      [
        { name: 'db', value: 'pubmed' },
        { name: 'id', value: identifier },
        { name: 'rettype', value: 'abstract' },
        { name: 'retmode', value: 'xml' },
      ],
      'text',
    );
    const article = parseArticle(text(body), identifier);
    if (!article) throw new Error(`pubmed article ${identifier} was not found`);
    const abstract = text(article.abstract);
    return [
      { ...article, abstract: args['full-abstract'] ? abstract : boundedText(abstract, 500) },
    ];
  },
});
function boundedText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
