export type ConversationWorkspaceSnapshot =
  | {
      cwd?: string;
      kind: 'draft';
      providerId: string;
      revision: string;
    }
  | {
      cwd?: string;
      kind: 'conversation';
      providerId: string;
      revision: string;
      conversationId: string;
    };

export interface ConversationWorkspaceChangedMessage {
  type: 'panerelay.workspace.changed';
  workspace: ConversationWorkspaceSnapshot | null;
}
