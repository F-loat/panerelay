import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentProviderSummary, ConversationSummary } from '@panerelay/protocol';
import {
  bootstrapProviderId,
  conversationProviderId,
  createProviderBootstrap,
  providerCacheValue,
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

test('round-trips only bounded presentation state for known providers', () => {
  const cache = providerCacheValue([
    {
      id: 'qoder',
      name: 'Untrusted runtime label',
      status: 'ready',
      description: 'Page content must not be cached',
      model: 'qoder-model',
      version: '1.2.3',
      setupHint: 'Do not persist this command',
    },
    {
      id: 'third-party',
      name: 'Third party',
      status: 'ready',
      description: 'Unknown provider',
    },
  ]);

  assert.deepEqual(cache, {
    version: 1,
    providers: [
      {
        id: 'qoder',
        status: 'ready',
        model: 'qoder-model',
        version: '1.2.3',
      },
    ],
  });

  const bootstrap = createProviderBootstrap('qoder', cache);
  assert.equal(bootstrap.preferredProviderId, 'qoder');
  assert.equal(bootstrapProviderId(bootstrap.providers, bootstrap.preferredProviderId), 'qoder');
  assert.deepEqual(
    bootstrap.providers.map(provider => [provider.id, provider.name, provider.status]),
    [
      ['qoder', 'Qoder', 'ready'],
      ['codex', 'Codex', 'unavailable'],
      ['claude', 'Claude Code', 'unavailable'],
      ['opencode', 'OpenCode', 'unavailable'],
    ],
  );
});

test('ignores malformed, stale, and oversized cached provider state', () => {
  assert.deepEqual(createProviderBootstrap('unknown', { version: 2, providers: [] }), {
    providers: [],
  });

  const bootstrap = createProviderBootstrap('qoder', {
    version: 1,
    providers: [
      { id: 'unknown', status: 'ready' },
      { id: 'codex', status: 'starting' },
      { id: 'qoder', status: 'ready', model: 'x'.repeat(257), version: '2.0.0' },
    ],
  });
  assert.equal(bootstrap.preferredProviderId, 'qoder');
  assert.equal(bootstrap.providers[0]?.id, 'qoder');
  assert.equal(bootstrap.providers[0]?.model, undefined);
  assert.equal(bootstrap.providers[0]?.version, '2.0.0');
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
