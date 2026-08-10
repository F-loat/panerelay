import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterInvocationRequest,
  SiteCommandDefinition,
} from '@panerelay/site-kit';
import { inspectSite } from '@panerelay/site-kit';
import author from './commands/author.js';
import paper from './commands/paper.js';
import recent from './commands/recent.js';
import search from './commands/search.js';

const COMMANDS: SiteCommandDefinition[] = [author, paper, recent, search];
const XML = `<feed xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><id>http://arxiv.org/abs/1706.03762v7</id><title>Attention &amp; Models</title><author><name>Alice</name></author><author><name>Bob</name></author><summary>A short abstract.</summary><published>2017-06-12T00:00:00Z</published><updated>2024-01-01T00:00:00Z</updated><arxiv:primary_category term="cs.CL"/><category term="cs.CL"/><category term="cs.LG"/><arxiv:comment>Conference paper</arxiv:comment><link rel="related" href="https://arxiv.org/pdf/1706.03762"/></entry></feed>`;

function context(command: string, body: string | unknown = XML) {
  const invocation: FetchAdapterInvocationRequest = {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: command,
    operation: 'execute',
    command,
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1/fetch',
      token: 'test',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation,
    fetch: async (request: BrowserFetchRequest): Promise<BrowserFetchResponse> => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/atom+xml' },
      body,
      bodyType: 'text',
      url: request.url,
      redirected: false,
      attachedCookieCount: 0,
    }),
  };
}

test('arXiv registers all four OpenCLI commands', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/arxiv', import.meta.url)));
  assert.deepEqual(
    value.manifest.commands.map(command => command.name).sort(),
    COMMANDS.map(command => command.name).sort(),
  );
  assert.equal(
    value.manifest.commands.find(command => command.name === 'search')?.args[0]?.positional,
    true,
  );
});

test('search maps Atom entries and paper preserves detail fields', async () => {
  const searchRows = await search.run(context('search'), { query: 'attention', limit: 1 });
  assert.deepEqual(searchRows, [
    {
      id: '1706.03762',
      title: 'Attention & Models',
      authors: 'Alice, Bob',
      published: '2017-06-12',
      primary_category: 'cs.CL',
      url: 'https://arxiv.org/abs/1706.03762',
    },
  ]);
  const paperRow = await paper.run(context('paper'), { id: '1706.03762' });
  assert.equal((paperRow as Array<Record<string, unknown>>)[0]?.abstract, 'A short abstract.');
  assert.equal((paperRow as Array<Record<string, unknown>>)[0]?.categories, 'cs.CL, cs.LG');
});

test('recent validates categories and reports empty feeds', async () => {
  await assert.rejects(
    () => recent.run(context('recent', '<feed></feed>'), { category: 'cs.CL', limit: 1 }),
    /No recent arXiv papers/,
  );
  await assert.rejects(
    () => recent.run(context('recent'), { category: 'not valid', limit: 1 }),
    /Invalid arXiv category/,
  );
});
