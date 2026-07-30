import {
  PANERELAY_PROTOCOL_VERSION,
  type AgentProviderSummary,
  type AgentRequest,
  type AgentRequestMessage,
  type ConversationDetail,
  type ConversationEvent,
  type ConversationSummary,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import type { AgentProvider } from './agent-provider.js';
import { CodexProvider } from './codex-provider.js';
import { validateConversationImages } from './conversation-images.js';
import { QoderProvider } from './qoder-provider.js';

export interface AgentServiceOptions {
  providers?: AgentProvider[];
}

function providerErrorDescriptor(provider: AgentProvider, error: unknown): AgentProviderSummary {
  return {
    id: provider.id,
    name: provider.id,
    status: 'error',
    description: 'The local provider could not be inspected.',
    setupHint: error instanceof Error ? error.message : String(error),
  };
}

export class AgentService {
  private readonly providers = new Map<string, AgentProvider>();
  private readonly conversationProviders = new Map<string, Set<string>>();
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    private readonly sendToExtension: (message: HostToExtensionMessage) => void,
    options: AgentServiceOptions = {},
  ) {
    const providers = options.providers ?? [new CodexProvider({}), new QoderProvider()];
    for (const provider of providers) {
      if (this.providers.has(provider.id)) {
        throw new Error(`Duplicate agent provider: ${provider.id}`);
      }
      this.providers.set(provider.id, provider);
      this.unsubscribe.push(
        provider.onEvent(event => this.forwardProviderEvent(provider.id, event)),
      );
    }
  }

  async handle(message: AgentRequestMessage): Promise<void> {
    try {
      const result = await this.route(message.request);
      this.sendToExtension({
        type: 'agent.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: true,
        result,
      });
    } catch (error) {
      this.sendToExtension({
        type: 'agent.response',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async close(): Promise<void> {
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe();
    await Promise.all([...this.providers.values()].map(provider => provider.close()));
    this.conversationProviders.clear();
  }

  private async route(request: AgentRequest): Promise<unknown> {
    if (request.method === 'agent.providers') {
      return Promise.all(
        [...this.providers.values()].map(async provider => {
          try {
            return await provider.getDescriptor();
          } catch (error) {
            return providerErrorDescriptor(provider, error);
          }
        }),
      );
    }

    const provider = this.providers.get(request.providerId);
    if (!provider) throw new Error(`Unknown agent provider: ${request.providerId}`);

    switch (request.method) {
      case 'agent.prepare':
        await provider.prepare();
        return {};
      case 'conversation.list': {
        const conversations = await provider.listConversations();
        for (const conversation of conversations) {
          this.assertResultProvider(provider.id, conversation);
          this.bindConversation(provider.id, conversation.id);
        }
        return conversations;
      }
      case 'conversation.start': {
        const detail = await provider.startConversation(request.options);
        this.acceptConversationDetail(provider.id, detail);
        return detail;
      }
      case 'conversation.resume': {
        this.assertNoProviderMismatch(provider.id, request.conversationId);
        const detail = await provider.resumeConversation(request.conversationId);
        this.acceptConversationDetail(provider.id, detail);
        return detail;
      }
      case 'conversation.send':
        this.assertConversationOwned(provider.id, request.conversationId);
        return provider.sendMessage(
          request.conversationId,
          request.text,
          validateConversationImages(request.images),
        );
      case 'conversation.interrupt':
        this.assertConversationOwned(provider.id, request.conversationId);
        return provider.interrupt(request.conversationId, request.turnId);
      case 'conversation.respond':
        this.assertConversationOwned(provider.id, request.conversationId);
        return provider.respondToApproval(
          request.conversationId,
          request.approvalId,
          request.decision,
        );
    }
  }

  private forwardProviderEvent(providerId: string, event: ConversationEvent): void {
    if ('conversationId' in event && event.conversationId) {
      this.bindConversation(providerId, event.conversationId);
    }
    this.sendToExtension({
      type: 'conversation.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event,
    });
  }

  private acceptConversationDetail(providerId: string, detail: ConversationDetail): void {
    this.assertResultProvider(providerId, detail.conversation);
    this.bindConversation(providerId, detail.conversation.id);
  }

  private assertResultProvider(providerId: string, conversation: ConversationSummary): void {
    if (conversation.providerId !== providerId) {
      throw new Error(
        `Provider ${providerId} returned a conversation owned by ${conversation.providerId}`,
      );
    }
  }

  private bindConversation(providerId: string, conversationId: string): void {
    const providers = this.conversationProviders.get(conversationId) ?? new Set<string>();
    providers.add(providerId);
    this.conversationProviders.set(conversationId, providers);
  }

  private assertNoProviderMismatch(providerId: string, conversationId: string): void {
    const providers = this.conversationProviders.get(conversationId);
    if (providers && !providers.has(providerId)) {
      throw new Error(`Conversation ${conversationId} belongs to another agent provider`);
    }
  }

  private assertConversationOwned(providerId: string, conversationId: string): void {
    const providers = this.conversationProviders.get(conversationId);
    if (!providers) throw new Error(`Unknown conversation: ${conversationId}`);
    if (!providers.has(providerId)) {
      throw new Error(`Conversation ${conversationId} belongs to another agent provider`);
    }
  }
}
