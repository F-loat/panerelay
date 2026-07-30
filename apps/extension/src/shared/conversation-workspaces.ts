export type ConversationWorkspaceSnapshot =
  | {
      kind: 'draft';
      providerId: string;
      revision: string;
    }
  | {
      kind: 'conversation';
      providerId: string;
      revision: string;
      conversationId: string;
    };

export interface ConversationWorkspaceChangedMessage {
  type: 'panerelay.workspace.changed';
  workspace: ConversationWorkspaceSnapshot | null;
}
