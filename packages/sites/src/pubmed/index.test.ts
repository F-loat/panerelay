import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import article from './commands/article.js';
import author from './commands/author.js';
import citations from './commands/citations.js';
import related from './commands/related.js';
import journal from './commands/journal.js';
import mesh from './commands/mesh.js';
import clinicalTrial from './commands/clinical-trial.js';
import review from './commands/review.js';

const summary = {
  result: {
    uids: ['123'],
    123: {
      uid: '123',
      title: 'Cancer study.',
      authors: [{ name: 'Alice A' }],
      fulljournalname: 'Test Journal',
      pubdate: '2024 Jan',
      pubtype: ['Journal Article'],
      articleids: [{ idtype: 'doi', value: '10.1000/test' }],
    },
  },
};
const xml =
  '<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><Journal><Title>Test Journal</Title><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal><ArticleTitle>Cancer study.</ArticleTitle><Abstract><AbstractText>Abstract text.</AbstractText></Abstract><AuthorList><Author><LastName>Alice</LastName><Initials>A</Initials></Author></AuthorList><Language>eng</Language><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/test</ArticleId></ArticleIdList></PubmedData></PubmedArticle>';
function context(body: unknown, bodyType: 'json' | 'text' = 'json') {
  const requests: Array<{ url: string; query?: unknown }> = [];
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    requests,
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'pubmed-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown }) => {
      requests.push(request);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}
function searchContext() {
  return context({ esearchresult: { idlist: ['123'] } });
}

test('PubMed maps search and article responses', async () => {
  const ctx = searchContext();
  const result = await search.run(
    {
      ...ctx,
      fetch: async (request: { url: string; query?: unknown }) => {
        ctx.requests.push(request);
        if (request.url.includes('esearch'))
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: { esearchresult: { idlist: ['123'] } },
            bodyType: 'json' as const,
            url: request.url,
            redirected: false,
            attachedCookieCount: 0,
          };
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: summary,
          bodyType: 'json' as const,
          url: request.url,
          redirected: false,
          attachedCookieCount: 0,
        };
      },
    },
    { query: 'cancer', limit: 5 },
  );
  assert.deepEqual(result[0], {
    rank: 1,
    pmid: '123',
    title: 'Cancer study',
    authors: 'Alice A',
    journal: 'Test Journal',
    year: '2024',
    article_type: 'Journal Article',
    doi: '10.1000/test',
    url: 'https://pubmed.ncbi.nlm.nih.gov/123/',
  });
  const articleContext = context(xml, 'text');
  const detail = await article.run(articleContext, { pmid: '123', 'full-abstract': true });
  const detailRow = detail[0] as Record<string, unknown>;
  assert.equal(detailRow.title, 'Cancer study.');
  assert.equal(detailRow.abstract, 'Abstract text.');
});

test('PubMed exposes all public commands and composes presets and links', async () => {
  for (const command of [
    search,
    article,
    author,
    citations,
    related,
    journal,
    mesh,
    clinicalTrial,
    review,
  ])
    assert.equal(command.access, 'read');
  const ctx = searchContext();
  const body = {
    ...ctx,
    fetch: async (request: { url: string; query?: unknown }) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: request.url.includes('esearch') ? { esearchresult: { idlist: ['123'] } } : summary,
      bodyType: 'json' as const,
      url: request.url,
      redirected: false,
      attachedCookieCount: 0,
    }),
  };
  const row = async (command: { run: (context: any, args: any) => Promise<unknown> }, args: any) =>
    ((await command.run(body as any, args)) as Array<Record<string, unknown>>)[0] ?? {};
  assert.equal((await row(journal, { journal: 'Nature', limit: 1 })).pmid, '123');
  assert.equal((await row(mesh, { term: 'Neoplasms', limit: 1 })).pmid, '123');
  assert.equal((await row(review, { query: 'cancer', limit: 1 })).pmid, '123');
  assert.equal((await row(clinicalTrial, { query: 'cancer', limit: 1 })).pmid, '123');
});
