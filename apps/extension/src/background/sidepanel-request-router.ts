import type { AgentRequest } from '@panerelay/protocol';
import type {
  AuthorizationMode,
  ExtensionStatus,
  SidePanelRequest,
  SidePanelResponse,
} from '../shared/messages.js';
import type { ConversationWorkspaceService } from './conversation-workspace-service.js';
import type { PageCommentService } from './page-comments.js';

type WorkspaceRequests = Pick<
  ConversationWorkspaceService,
  'get' | 'reset' | 'resume' | 'send' | 'setDirectory'
>;
type PageCommentRequests = Pick<PageCommentService, 'clear' | 'edit' | 'remove' | 'start' | 'stop'>;

export interface SidePanelRequestRouterOptions {
  activateControlledTab: (tabId: number) => Promise<void>;
  closeControlledTab: (tabId: number) => Promise<void>;
  pageComments: PageCommentRequests;
  refreshBrowserDefault: () => Promise<void>;
  refreshBrowserUseDefault: () => Promise<void>;
  requestAgent: (request: AgentRequest) => Promise<unknown>;
  selectWorkspaceDirectory: () => Promise<string | null>;
  setAuthorization: (mode: AuthorizationMode) => Promise<ExtensionStatus>;
  setBrowserDefault: (enabled: boolean) => Promise<ExtensionStatus>;
  setBrowserUseDefault: (enabled: boolean) => Promise<ExtensionStatus>;
  setDefaultProvider: (enabled: boolean) => Promise<ExtensionStatus>;
  status: () => Promise<ExtensionStatus>;
  retryNativeHost: () => Promise<ExtensionStatus>;
  workspace: WorkspaceRequests;
}

export function createSidePanelRequestRouter(options: SidePanelRequestRouterOptions) {
  return async function handleSidePanelRequest(
    message: SidePanelRequest,
  ): Promise<SidePanelResponse> {
    switch (message.type) {
      case 'panerelay.status.get':
        return { success: true, status: await options.status() };
      case 'panerelay.authorization.set':
        return { success: true, status: await options.setAuthorization(message.mode) };
      case 'panerelay.native.retry':
        return { success: true, status: await options.retryNativeHost() };
      case 'panerelay.default-provider.set':
        return { success: true, status: await options.setDefaultProvider(message.enabled) };
      case 'panerelay.browser-use-default.set':
        return { success: true, status: await options.setBrowserUseDefault(message.enabled) };
      case 'panerelay.browser-use-default.refresh':
        await options.refreshBrowserUseDefault();
        return { success: true, status: await options.status() };
      case 'panerelay.browser-default.set':
        return { success: true, status: await options.setBrowserDefault(message.enabled) };
      case 'panerelay.browser-default.refresh':
        await options.refreshBrowserDefault();
        return { success: true, status: await options.status() };
      case 'panerelay.controlled-tab.activate':
        await options.activateControlledTab(message.tabId);
        return { success: true };
      case 'panerelay.controlled-tab.close':
        await options.closeControlledTab(message.tabId);
        return { success: true };
      case 'panerelay.agent.providers':
        return {
          success: true,
          providers: (await options.requestAgent({
            method: 'agent.providers',
          })) as Awaited<Extract<SidePanelResponse, { providers: unknown }>['providers']>,
        };
      case 'panerelay.agent.prepare':
        await options.requestAgent({ method: 'agent.prepare', providerId: message.providerId });
        return { success: true };
      case 'panerelay.workspace.get':
        return {
          success: true,
          workspace: await options.workspace.get(message.providerId),
        };
      case 'panerelay.workspace.reset':
        return {
          success: true,
          workspace: await options.workspace.reset(message.providerId, message.expectedRevision),
        };
      case 'panerelay.workspace.pick-directory': {
        const path = await options.selectWorkspaceDirectory();
        if (!path) return { success: true };
        return {
          success: true,
          workspace: await options.workspace.setDirectory(message.expectedRevision, path),
        };
      }
      case 'panerelay.workspace.clear-directory':
        return {
          success: true,
          workspace: await options.workspace.setDirectory(message.expectedRevision),
        };
      case 'panerelay.page-comments.start':
        await options.pageComments.start(
          message.continuous === true,
          message.locale,
          message.theme,
        );
        return { success: true };
      case 'panerelay.page-comments.stop':
        await options.pageComments.stop();
        return { success: true };
      case 'panerelay.page-comments.edit':
        await options.pageComments.edit(message.commentId);
        return { success: true };
      case 'panerelay.page-comments.remove':
        await options.pageComments.remove(message.commentId);
        return { success: true };
      case 'panerelay.page-comments.clear':
        await options.pageComments.clear();
        return { success: true };
      case 'panerelay.conversation.list':
        return {
          success: true,
          conversations: (await options.requestAgent({
            method: 'conversation.list',
            providerId: message.providerId,
          })) as Awaited<Extract<SidePanelResponse, { conversations: unknown }>['conversations']>,
        };
      case 'panerelay.conversation.resume':
        return {
          success: true,
          ...(await options.workspace.resume(
            message.providerId,
            message.conversationId,
            message.expectedRevision,
          )),
        };
      case 'panerelay.conversation.send':
        return {
          success: true,
          ...(await options.workspace.send(
            message.providerId,
            message.expectedRevision,
            message.text,
            message.conversationId,
            message.images,
          )),
        };
      case 'panerelay.conversation.interrupt':
        await options.requestAgent({
          method: 'conversation.interrupt',
          providerId: message.providerId,
          conversationId: message.conversationId,
          turnId: message.turnId,
        });
        return { success: true };
      case 'panerelay.conversation.respond':
        await options.requestAgent({
          method: 'conversation.respond',
          providerId: message.providerId,
          conversationId: message.conversationId,
          approvalId: message.approvalId,
          decision: message.decision,
        });
        return { success: true };
    }
  };
}
