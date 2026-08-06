import type {
  AgentRequest,
  ConversationDetail,
  ConversationImageInput,
  ConversationPageContext,
} from '@panerelay/protocol';
import type { ConversationWorkspaceSnapshot } from '../shared/conversation-workspaces.js';
import {
  ConversationWorkspaceStore,
  type ConversationWorkspaceReservation,
} from './conversation-workspaces.js';

export interface ConversationWorkspaceServiceOptions {
  activeTabId: () => Promise<number | null>;
  activeTabContext?: (tabId: number) => Promise<ConversationPageContext>;
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

  async setDirectory(
    expectedRevision: string,
    cwd?: string,
  ): Promise<ConversationWorkspaceSnapshot> {
    const tabId = await this.requireActiveTabId();
    const workspace = await this.options.store.setDirectory(tabId, expectedRevision, cwd);
    await this.changed(tabId, workspace);
    return workspace;
  }

  async resume(
    providerId: string,
    conversationId: string,
    expectedRevision: string,
  ): Promise<WorkspaceConversationResult> {
    const tabId = await this.requireActiveTabId();
    await this.options.store.assertCurrentRevision(tabId, expectedRevision);
    const conversation = (await this.options.requestAgent({
      method: 'conversation.resume',
      providerId,
      conversationId,
    })) as ConversationDetail;
    const workspace = await this.options.store.joinConversation(
      tabId,
      expectedRevision,
      providerId,
      conversationId,
    );
    await this.changed(tabId, workspace);
    return { conversation, workspace };
  }

  async send(
    providerId: string,
    expectedRevision: string,
    text: string,
    conversationId?: string,
    images?: ConversationImageInput[],
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
        ...(images?.length ? { images } : {}),
      })) as { turnId: string };
      return { turnId: result.turnId, workspace };
    }

    const reservation = await this.options.store.reserve(tabId, expectedRevision);
    try {
      const initialPage = await this.initialPage(tabId);
      const conversation = (await this.options.requestAgent({
        method: 'conversation.start',
        providerId,
        options: {
          ...(reservation.previous.cwd ? { cwd: reservation.previous.cwd } : {}),
          ...(initialPage ? { initialPage } : {}),
        },
      })) as ConversationDetail;
      const createdId = conversation.conversation.id;
      const result = (await this.options.requestAgent({
        method: 'conversation.send',
        providerId,
        conversationId: createdId,
        text,
        ...(images?.length ? { images } : {}),
      })) as { turnId: string };
      const workspace = await this.options.store.commit(reservation, {
        ...(reservation.previous.cwd ? { cwd: reservation.previous.cwd } : {}),
        kind: 'conversation',
        providerId,
        conversationId: createdId,
      });
      await this.changed(tabId, workspace);
      return { conversation, turnId: result.turnId, workspace };
    } catch (error) {
      await this.rollback(reservation);
      throw error;
    }
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

  private async initialPage(tabId: number): Promise<ConversationPageContext | undefined> {
    try {
      const context = await this.options.activeTabContext?.(tabId);
      if (!context?.url && !context?.title && !context?.target) return undefined;
      return {
        ...(context.url ? { url: context.url } : {}),
        ...(context.title ? { title: context.title } : {}),
        ...(context.target ? { target: { ...context.target } } : {}),
      };
    } catch {
      return undefined;
    }
  }

  private async requireActiveTabId(): Promise<number> {
    const tabId = await this.options.activeTabId();
    if (tabId === null) throw new Error('No active browser tab is available');
    return tabId;
  }
}
