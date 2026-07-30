import assert from 'node:assert/strict';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
  sanitizeConversationPageUrl,
} from './agent-context.js';

test('redacts sensitive URL metadata and bounds the page title', () => {
  const url = sanitizeConversationPageUrl(
    'https://user:pass@example.com/page?token=abc&view=full#session=secret',
  );
  assert.doesNotMatch(url, /user|pass|abc|secret/);
  assert.match(url, /%5BREDACTED%5D/);

  const resolved = resolveConversationStartOptions({
    initialPage: { url, title: 'x'.repeat(500) },
  });
  assert.equal(resolved.initialPage?.title?.length, 300);
});

test('validates the workspace and creates untrusted context without a tab id', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-context-'));
  const resolved = resolveConversationStartOptions({
    cwd: directory,
    initialPage: { url: 'https://example.com/app', title: 'Example app' },
  });
  const instructions = createConversationContextInstructions(resolved);

  assert.equal(resolved.cwd, await realpath(directory));
  assert.match(instructions, /projectDirectory/);
  assert.match(instructions, /untrusted metadata/);
  assert.match(instructions, /https:\/\/example\.com\/app/);
  assert.doesNotMatch(instructions, /"tabId"/);
});
