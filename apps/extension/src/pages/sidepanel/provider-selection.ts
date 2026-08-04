import type {
  AgentProviderSetupGuide,
  AgentProviderSummary,
  ConversationSummary,
} from '@panerelay/protocol';

type SupportedProvider = AgentProviderSummary & { setup: AgentProviderSetupGuide };

const PROVIDER_CACHE_VERSION = 1;
const MAX_CACHED_LABEL_CHARS = 256;

export const PROVIDER_CACHE_KEY = 'panerelay.agentProviders.v1';

interface CachedProviderEntry {
  id: string;
  status: AgentProviderSummary['status'];
  model?: string;
  version?: string;
}

interface ProviderCacheValue {
  version: typeof PROVIDER_CACHE_VERSION;
  providers: CachedProviderEntry[];
}

export interface ProviderBootstrap {
  preferredProviderId?: string;
  providers: AgentProviderSummary[];
}

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

function supportedProvider(id: unknown): SupportedProvider | undefined {
  return typeof id === 'string'
    ? SUPPORTED_PROVIDERS.find(provider => provider.id === id)
    : undefined;
}

function cachedLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const label = value.trim();
  return label && label.length <= MAX_CACHED_LABEL_CHARS ? label : undefined;
}

function cachedStatus(value: unknown): AgentProviderSummary['status'] | undefined {
  return value === 'ready' || value === 'unavailable' || value === 'error' ? value : undefined;
}

export function providerCacheValue(providers: AgentProviderSummary[]): ProviderCacheValue {
  return {
    version: PROVIDER_CACHE_VERSION,
    providers: providers.flatMap(provider => {
      if (!supportedProvider(provider.id)) return [];
      return [
        {
          id: provider.id,
          status: provider.status,
          ...(cachedLabel(provider.model) ? { model: cachedLabel(provider.model) } : {}),
          ...(cachedLabel(provider.version) ? { version: cachedLabel(provider.version) } : {}),
        },
      ];
    }),
  };
}

export function createProviderBootstrap(
  preferredProviderId: unknown,
  cache: unknown,
): ProviderBootstrap {
  const preferred = supportedProvider(preferredProviderId)?.id;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) {
    return { ...(preferred ? { preferredProviderId: preferred } : {}), providers: [] };
  }
  const value = cache as Record<string, unknown>;
  if (value.version !== PROVIDER_CACHE_VERSION || !Array.isArray(value.providers)) {
    return { ...(preferred ? { preferredProviderId: preferred } : {}), providers: [] };
  }
  const cached = value.providers.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const entry = item as Record<string, unknown>;
    const provider = supportedProvider(entry.id);
    const status = cachedStatus(entry.status);
    if (!provider || !status) return [];
    const model = cachedLabel(entry.model);
    const version = cachedLabel(entry.version);
    return [
      {
        ...provider,
        status,
        ...(model ? { model } : {}),
        ...(version ? { version } : {}),
      },
    ];
  });
  return {
    ...(preferred ? { preferredProviderId: preferred } : {}),
    providers: cached.length > 0 ? supportedProviders(cached) : [],
  };
}

export function bootstrapProviderId(
  providers: AgentProviderSummary[],
  preferredProviderId: string | undefined,
): string {
  return preferredProviderId && providers.some(provider => provider.id === preferredProviderId)
    ? preferredProviderId
    : selectProviderId(providers, preferredProviderId);
}

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
