import {
  getSessionInfo,
  getSessionMessages,
  listSessions,
  query,
  type GetSessionInfoOptions,
  type GetSessionMessagesOptions,
  type ListSessionsOptions,
  type Options,
  type Query,
  type SDKMessage,
  type SDKSessionInfo,
  type SDKUserMessage,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeQueryParameters {
  options?: Options;
  prompt: string | AsyncIterable<SDKUserMessage>;
}

export interface ClaudeAgentSdk {
  getSessionInfo(
    sessionId: string,
    options?: GetSessionInfoOptions,
  ): Promise<SDKSessionInfo | undefined>;
  getSessionMessages(
    sessionId: string,
    options?: GetSessionMessagesOptions,
  ): Promise<SessionMessage[]>;
  listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]>;
  query(parameters: ClaudeQueryParameters): Query;
}

export function createClaudeAgentSdk(): ClaudeAgentSdk {
  return {
    getSessionInfo,
    getSessionMessages,
    listSessions,
    query,
  };
}

export type {
  Options as ClaudeAgentOptions,
  Query as ClaudeQuery,
  SDKMessage as ClaudeSdkMessage,
  SDKSessionInfo as ClaudeSessionInfo,
  SDKUserMessage as ClaudeSdkUserMessage,
  SessionMessage as ClaudeSessionMessage,
};
