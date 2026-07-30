import type {
  AgentProviderSummary,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationImageInput,
  ConversationStartOptions,
  ConversationSummary,
} from '@panerelay/protocol';

export interface AgentProvider {
  readonly id: string;
  close(): Promise<void>;
  getDescriptor(): Promise<AgentProviderSummary>;
  prepare(): Promise<void>;
  interrupt(conversationId: string, turnId: string): Promise<Record<string, never>>;
  listConversations(): Promise<ConversationSummary[]>;
  onEvent(listener: (event: ConversationEvent) => void): () => void;
  respondToApproval(
    conversationId: string,
    approvalId: string,
    decision: ConversationApprovalDecision,
  ): Promise<Record<string, never>>;
  resumeConversation(conversationId: string): Promise<ConversationDetail>;
  sendMessage(
    conversationId: string,
    text: string,
    images?: ConversationImageInput[],
  ): Promise<{ turnId: string }>;
  startConversation(options?: ConversationStartOptions): Promise<ConversationDetail>;
}
