import type {
  AgentProviderSetupGuide,
  AgentProviderSummary,
  ConversationSummary,
} from '@panerelay/protocol';

type SupportedProvider = AgentProviderSummary & { setup: AgentProviderSetupGuide };

const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  {
    id: 'codex',
    name: 'Codex',
    status: 'unavailable',
    description: 'Local Codex app-server with streamed turns, tools, and approvals.',
    setup: {
      installCommand: 'npm install -g @openai/codex',
      loginCommand: 'codex login',
      docsUrl: 'https://developers.openai.com/codex/cli',
    },
  },
  {
    id: 'claude',
    name: 'Claude Code',
    status: 'unavailable',
    description: 'Local Claude Code through the official Claude Agent SDK.',
    setup: {
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      loginCommand: 'claude',
      docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    },
  },
  {
    id: 'qoder',
    name: 'Qoder',
    status: 'unavailable',
    description: 'Local Qoder CLI through capability-negotiated ACP sessions.',
    setup: {
      installCommand: 'npm install -g @qoder-ai/qodercli',
      loginCommand: 'qodercli',
      docsUrl: 'https://docs.qoder.com/en/cli/quick-start',
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    status: 'unavailable',
    description: 'Local OpenCode CLI through capability-negotiated ACP sessions.',
    setup: {
      installCommand: 'npm install -g opencode-ai',
      loginCommand: 'opencode auth login',
      docsUrl: 'https://opencode.ai/docs/acp/',
    },
  },
];

export function supportedProviders(
  discoveredProviders: AgentProviderSummary[],
): AgentProviderSummary[] {
  const discoveredById = new Map(
    discoveredProviders.map(provider => [provider.id, provider] as const),
  );
  return SUPPORTED_PROVIDERS.map((supported, catalogIndex) => {
    const discovered = discoveredById.get(supported.id);
    const provider = discovered
      ? {
          ...supported,
          ...discovered,
          setup: {
            ...supported.setup,
            ...discovered.setup,
          },
        }
      : { ...supported, setup: { ...supported.setup } };
    return { catalogIndex, provider };
  })
    .sort((left, right) => {
      const availabilityOrder =
        Number(right.provider.status === 'ready') - Number(left.provider.status === 'ready');
      return availabilityOrder || left.catalogIndex - right.catalogIndex;
    })
    .map(({ provider }) => provider);
}

export function selectProviderId(
  providers: AgentProviderSummary[],
  preferredProviderId: string | undefined,
): string {
  if (
    preferredProviderId &&
    providers.some(provider => provider.id === preferredProviderId && provider.status === 'ready')
  ) {
    return preferredProviderId;
  }
  return (
    providers.find(provider => provider.status === 'ready')?.id ??
    providers.find(provider => provider.id === 'codex')?.id ??
    providers[0]?.id ??
    'codex'
  );
}

export function conversationProviderId(
  conversation: ConversationSummary | null | undefined,
  selectedProviderId: string,
): string {
  return conversation?.providerId || selectedProviderId;
}
