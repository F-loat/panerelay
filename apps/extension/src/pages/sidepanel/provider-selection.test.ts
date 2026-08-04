import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentProviderSummary, ConversationSummary } from '@panerelay/protocol';
import {
  conversationProviderId,
  selectProviderId,
  supportedProviders,
} from './provider-selection.js';

const providers: AgentProviderSummary[] = [
  {
    id: 'codex',
    name: 'Codex',
    status: 'ready',
    description: 'Codex',
  },
  {
    id: 'qoder',
    name: 'Qoder',
    status: 'unavailable',
    description: 'Qoder',
    setupHint: 'Install Qoder',
  },
];

test('keeps the supported catalog visible and overlays discovered readiness', () => {
  const catalog = supportedProviders([providers[1]!]);
  assert.deepEqual(
    catalog.map(provider => [provider.id, provider.status]),
    [
      ['codex', 'unavailable'],
      ['claude', 'unavailable'],
      ['qoder', 'unavailable'],
      ['opencode', 'unavailable'],
    ],
  );
  assert.equal(catalog[0]?.setup?.installCommand, 'npm install -g @openai/codex');
  assert.equal(catalog[1]?.setup?.installCommand, 'npm install -g @anthropic-ai/claude-code');
  assert.equal(catalog[2]?.setupHint, 'Install Qoder');
  assert.deepEqual(catalog[3]?.setup, {
    installCommand: 'npm install -g opencode-ai',
    loginCommand: 'opencode auth login',
    docsUrl: 'https://opencode.ai/docs/acp/',
  });

  const qoderReady = supportedProviders([
    {
      ...providers[1]!,
      status: 'ready',
      setup: {
        installCommand: 'curl -fsSL https://qoder.com/install | bash',
        loginCommand: 'qodercli',
        docsUrl: 'https://docs.qoder.com/en/cli/quick-start',
      },
    },
  ]);
  assert.deepEqual(
    qoderReady.map(provider => [provider.id, provider.status]),
    [
      ['qoder', 'ready'],
      ['codex', 'unavailable'],
      ['claude', 'unavailable'],
      ['opencode', 'unavailable'],
    ],
  );
  assert.equal(qoderReady[0]?.setup?.installCommand, 'curl -fsSL https://qoder.com/install | bash');
});

test('groups installed providers first and preserves catalog order within each group', () => {
  const catalog = supportedProviders([
    {
      id: 'opencode',
      name: 'OpenCode',
      status: 'ready',
      description: 'OpenCode',
    },
    {
      id: 'codex',
      name: 'Codex',
      status: 'ready',
      description: 'Codex',
    },
  ]);

  assert.deepEqual(
    catalog.map(provider => [provider.id, provider.status]),
    [
      ['codex', 'ready'],
      ['opencode', 'ready'],
      ['claude', 'unavailable'],
      ['qoder', 'unavailable'],
    ],
  );
});

test('prefers an installed provider and falls back to Codex when none are installed', () => {
  assert.equal(selectProviderId(providers, 'qoder'), 'codex');
  assert.equal(selectProviderId(providers, 'missing'), 'codex');
  assert.equal(selectProviderId([{ ...providers[1]!, status: 'ready' }], 'qoder'), 'qoder');
  assert.equal(selectProviderId(supportedProviders([]), 'qoder'), 'codex');
  assert.equal(selectProviderId([], 'qoder'), 'codex');
});

test('routes conversation operations through the originating provider', () => {
  const conversation: ConversationSummary = {
    id: 'qoder-session',
    providerId: 'qoder',
    title: 'Qoder session',
    preview: '',
    status: 'idle',
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
  assert.equal(conversationProviderId(conversation, 'codex'), 'qoder');
  assert.equal(conversationProviderId(null, 'codex'), 'codex');
});
