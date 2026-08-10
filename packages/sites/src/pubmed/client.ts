import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
export const ARTICLE_URL = 'https://pubmed.ncbi.nlm.nih.gov';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`pubmed ${label} cannot be empty`);
  return result;
}
export function bounded(value: unknown, fallback = 20, max = 100, label = 'limit'): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max)
    throw new Error(`pubmed ${label} must be an integer between 1 and ${max}`);
  return result;
}
export function pmid(value: unknown): string {
  const result = required(value, 'pmid');
  if (!/^\d+$/.test(result)) throw new Error('pubmed pmid must be numeric');
  return result;
}
export function choice(value: unknown, values: string[], fallback: string, label: string): string {
  const result = text(value || fallback);
  if (!values.includes(result))
    throw new Error(`pubmed ${label} must be one of: ${values.join(', ')}`);
  return result;
}
export function year(value: unknown, label: string): number | undefined {
  if (value == null || value === '') return undefined;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1800 || result > 3000)
    throw new Error(`pubmed ${label} must be a year between 1800 and 3000`);
  return result;
}
export function yearFilter(from: number | undefined, to: number | undefined): string {
  if (from == null && to == null) return '';
  const start = from ?? 1800;
  const end = to ?? new Date().getFullYear();
  if (start > end) throw new Error('pubmed year-from must be <= year-to');
  return `${start}:${end}[PDAT]`;
}
export function searchQuery(
  query: unknown,
  filters: {
    author?: unknown;
    journal?: unknown;
    from?: unknown;
    to?: unknown;
    type?: unknown;
    abstract?: unknown;
    fullText?: unknown;
    humans?: unknown;
    english?: unknown;
  } = {},
): string {
  const terms = [required(query, 'query')];
  if (filters.author) terms.push(`${required(filters.author, 'author')}[Author]`);
  if (filters.journal) terms.push(`${required(filters.journal, 'journal')}[Journal]`);
  const date = yearFilter(year(filters.from, 'year-from'), year(filters.to, 'year-to'));
  if (date) terms.push(date);
  if (filters.type) terms.push(`${required(filters.type, 'article-type')}[PT]`);
  if (filters.abstract) terms.push('hasabstract[text]');
  if (filters.fullText) terms.push('free full text[sb]');
  if (filters.humans) terms.push('humans[mesh]');
  if (filters.english) terms.push('english[lang]');
  return terms.join(' AND ');
}
function clean(value: unknown): string {
  return text(value).replace(/\s+/g, ' ');
}
function trunc(value: unknown, max: number): string {
  const result = clean(value);
  return result.length > max ? `${result.slice(0, max - 3)}...` : result;
}
function authors(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const names = value
    .map(item =>
      clean(
        pick(item, 'name') ||
          pick(item, 'collectivename') ||
          `${text(pick(item, 'lastname'))} ${text(pick(item, 'initials'))}`,
      ),
    )
    .filter(Boolean);
  return [...names.slice(0, 3), ...(names.length > 3 ? ['et al.'] : [])].join(', ');
}
function articleType(value: unknown): string {
  const types = Array.isArray(value)
    ? value.map(item => text(typeof item === 'string' ? item : pick(item, 'value'))).filter(Boolean)
    : [];
  return (
    types.find(item =>
      /systematic review|meta-analysis|review|randomized controlled trial|clinical trial|case reports|journal article/i.test(
        item,
      ),
    ) ||
    types[0] ||
    'Journal Article'
  );
}
function doi(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return text(
    value.find(item => text(pick(item, 'idtype')).toLowerCase() === 'doi') &&
      pick(
        value.find(item => text(pick(item, 'idtype')).toLowerCase() === 'doi'),
        'value',
      ),
  );
}
export function summaryRow(article: unknown, rank: number, id = pick(article, 'uid')) {
  const value = article && typeof article === 'object' ? article : {};
  const identifier = text(id);
  return {
    rank,
    pmid: identifier,
    title: trunc(text(pick(value, 'title')).replace(/\.$/, ''), 120),
    authors: authors(pick(value, 'authors')),
    journal: trunc(pick(value, 'fulljournalname') || pick(value, 'source'), 60),
    year: text(pick(value, 'pubdate')).split(' ')[0] || '',
    article_type: articleType(pick(value, 'pubtype')),
    doi: doi(pick(value, 'articleids')),
    url: `${ARTICLE_URL}/${identifier}/`,
  };
}

export class PubMedClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(
    tool: string,
    query: Array<{ name: string; value: string }> = [],
    responseType: 'json' | 'text' = 'json',
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${tool}.fcgi`,
      query,
      headers: { accept: responseType === 'json' ? 'application/json' : 'application/xml' },
      responseType,
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== responseType)
      throw new Error(`pubmed ${tool} request failed: HTTP ${response.status}`);
    if (responseType === 'json' && pick(response.body, 'error'))
      throw new Error(`pubmed ${tool} returned an error`);
    return response.body;
  }
}
export async function summaries(
  client: PubMedClient,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const body = await client.request('esummary', [
    { name: 'db', value: 'pubmed' },
    { name: 'retmode', value: 'json' },
    { name: 'id', value: ids.join(',') },
  ]);
  const result = pick(body, 'result');
  if (!result || typeof result !== 'object')
    throw new Error('pubmed summary returned an unreadable payload');
  return ids.map((id, index) => {
    const article = pick(result, id);
    if (!article) throw new Error('pubmed summary omitted one or more PMIDs');
    return summaryRow(article, index + 1, id);
  });
}
function xmlText(value: string, tag: string): string {
  return clean(
    (value.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1] ?? '').replace(
      /<[^>]+>/g,
      ' ',
    ),
  );
}
function xmlAll(value: string, tag: string): string[] {
  return [...value.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))]
    .map(match => clean(match[1] ?? '').replace(/<[^>]+>/g, ' '))
    .filter(Boolean);
}
export function parseArticle(xml: string, identifier: string): Record<string, unknown> | null {
  if (!xml || /<ERROR\b/i.test(xml) || !/<PubmedArticle\b/i.test(xml)) return null;
  const returned = xmlText(xml, 'PMID');
  if (returned !== identifier)
    throw new Error('pubmed article response PMID did not match request');
  const article = xml.match(/<Article\b[^>]*>([\s\S]*?)<\/Article>/i)?.[1] || xml;
  const journal = article.match(/<Journal\b[^>]*>([\s\S]*?)<\/Journal>/i)?.[1] || '';
  const pubDate = journal.match(/<PubDate\b[^>]*>([\s\S]*?)<\/PubDate>/i)?.[1] || '';
  const authorBlocks = [...xml.matchAll(/<Author\b[^>]*>([\s\S]*?)<\/Author>/gi)].map(
    match => match[1] ?? '',
  );
  const authorNames = authorBlocks
    .map(
      block =>
        xmlText(block, 'CollectiveName') ||
        [xmlText(block, 'LastName'), xmlText(block, 'ForeName') || xmlText(block, 'Initials')]
          .filter((value): value is string => Boolean(value))
          .join(' '),
    )
    .filter(Boolean);
  const articleIds = [
    ...xml.matchAll(/<ArticleId\b[^>]*IdType="([^"]+)"[^>]*>([\s\S]*?)<\/ArticleId>/gi),
  ];
  const idOf = (kind: string) => {
    const match = articleIds.find(item => (item[1] ?? '').toLowerCase() === kind);
    return clean(match?.[2] ?? '');
  };
  return {
    pmid: identifier,
    title: xmlText(article, 'ArticleTitle'),
    authors: authorNames.join(', '),
    journal: xmlText(journal, 'Title') || xmlText(journal, 'ISOAbbreviation'),
    year: xmlText(pubDate, 'Year') || xmlText(xml, 'MedlineDate').slice(0, 4),
    date: [xmlText(pubDate, 'Year'), xmlText(pubDate, 'Month'), xmlText(pubDate, 'Day')]
      .filter((value): value is string => Boolean(value))
      .join(' '),
    article_type: articleType(xmlAll(article, 'PublicationType')),
    language: xmlText(article, 'Language'),
    doi: idOf('doi'),
    pmc: idOf('pmc'),
    affiliations: xmlAll(xml, 'Affiliation').slice(0, 10).join(' | '),
    grants: [...xml.matchAll(/<Grant\b[^>]*>([\s\S]*?)<\/Grant>/gi)]
      .map(match =>
        [xmlText(match[1] ?? '', 'GrantID'), xmlText(match[1] ?? '', 'Agency')]
          .filter((value): value is string => Boolean(value))
          .join(': '),
      )
      .filter(Boolean)
      .slice(0, 10)
      .join(' | '),
    mesh_terms: xmlAll(xml, 'DescriptorName').slice(0, 10).join(', '),
    keywords: xmlAll(xml, 'Keyword').slice(0, 10).join(', '),
    abstract: xmlAll(article, 'AbstractText').join(' '),
    url: `${ARTICLE_URL}/${identifier}/`,
  };
}
