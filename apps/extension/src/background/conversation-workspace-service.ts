import type { AgentRequest, ConversationDetail } from '@panerelay/protocol';
import type { ConversationWorkspaceSnapshot } from '../shared/conversation-workspaces.js';
import {
  ConversationWorkspaceStore,
  type ConversationWorkspaceReservation,
} from './conversation-workspaces.js';

export interface ConversationWorkspaceServiceOptions {
  activeTabId: () => Promise<number | null>;
  onChanged?: (tabId: number, workspace: ConversationWorkspaceSnapshot) => void | Promise<void>;
  requestAgent: (request: AgentRequest) => Promise<unknown>;
  store: ConversationWorkspaceStore;
}

export interface WorkspaceConversationResult {
  conversation: ConversationDetail;
  workspace: ConversationWorkspaceSnapshot;
}

export interface WorkspaceSendResult {
  conversation?: ConversationDetail;
  turnId: string;
  workspace: ConversationWorkspaceSnapshot;
}

export class ConversationWorkspaceService {
  constructor(private readonly options: ConversationWorkspaceServiceOptions) {}

  async get(providerId: string): Promise<ConversationWorkspaceSnapshot> {
    const tabId = await this.requireActiveTabId();
    return this.options.store.getOrCreate(tabId, providerId);
  }

  async reset(
    providerId: string,
    expectedRevision: string,
  ): Promise<ConversationWorkspaceSnapshot> {
    const tabId = await this.requireActiveTabId();
    const workspace = await this.options.store.reset(tabId, expectedRevision, providerId);
    await this.changed(tabId, workspace);
    return workspace;
  }

  async resume(
    providerId: string,
    conversationId: string,
    expectedRevision: string,
  ): Promise<WorkspaceConversationResult> {
    const tabId = await this.requireActiveTabId();
    const reservation = await this.options.store.reserve(tabId, expectedRevision);
    try {
      const conversation = (await this.options.requestAgent({
        method: 'conversation.resume',
        providerId,
        conversationId,
      })) as ConversationDetail;
      const workspace = await this.options.store.commit(reservation, {
        kind: 'conversation',
        providerId,
        conversationId,
      });
      await this.changed(tabId, workspace);
      return { conversation, workspace };
    } catch (error) {
      await this.rollback(reservation);
      throw error;
    }
  }

  async send(
    providerId: string,
    expectedRevision: string,
    text: string,
    conversationId?: string,
  ): Promise<WorkspaceSendResult> {
    const tabId = await this.requireActiveTabId();
    if (conversationId) {
      const workspace = await this.options.store.assertCurrent(tabId, expectedRevision, {
        kind: 'conversation',
        providerId,
        conversationId,
      });
      const result = (await this.options.requestAgent({
        method: 'conversation.send',
        providerId,
        conversationId,
        text,
      })) as { turnId: string };
      return { turnId: result.turnId, workspace };
    }

    const reservation = await this.options.store.reserve(tabId, expectedRevision);
    let conversation: ConversationDetail;
    try {
      conversation = (await this.options.requestAgent({
        method: 'conversation.start',
        providerId,
      })) as ConversationDetail;
    } catch (error) {
      await this.rollback(reservation);
      throw error;
    }

    const createdId = conversation.conversation.id;
    const workspace = await this.options.store.commit(reservation, {
      kind: 'conversation',
      providerId,
      conversationId: createdId,
    });
    await this.changed(tabId, workspace);
    const result = (await this.options.requestAgent({
      method: 'conversation.send',
      providerId,
      conversationId: createdId,
      text,
    })) as { turnId: string };
    return { conversation, turnId: result.turnId, workspace };
  }

  private async rollback(reservation: ConversationWorkspaceReservation): Promise<void> {
    await this.options.store
      .rollback(reservation)
      .then(workspace => this.changed(reservation.tabId, workspace))
      .catch(() => {
        // A newer workspace mutation owns the revision; preserve it.
      });
  }

  private async changed(tabId: number, workspace: ConversationWorkspaceSnapshot): Promise<void> {
    await this.options.onChanged?.(tabId, workspace);
  }

  private async requireActiveTabId(): Promise<number> {
    const tabId = await this.options.activeTabId();
    if (tabId === null) throw new Error('No active browser tab is available');
    return tabId;
  }
}
