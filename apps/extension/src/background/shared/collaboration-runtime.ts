import {
  PANERELAY_NATIVE_HOST_NAME,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isNativeTransferEnvelope,
  type AgentProviderSummary,
  type AgentRequest,
  type AgentResponseMessage,
  type BrowserAutomationCapability,
  type ConversationSummary,
  type HostToExtensionMessage,
  type IntegrationDefaultProviderResult,
  type IntegrationRequest,
  type IntegrationResponseMessage,
  type IntegrationResult,
  type IntegrationWorkspaceDirectoryResult,
} from '@panerelay/protocol';
import type {
  AuthorizationMode,
  ConversationChangedMessage,
  ConversationWorkspaceChangedMessage,
  DefaultProviderState,
  ExtensionStatus,
  NativeHostState,
  SidePanelRequest,
  SidePanelResponse,
  StatusChangedMessage,
  TabSummary,
} from '../../shared/messages.js';
import { originAuthorizationForUrl } from '../../shared/authorization.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type { BrowserRuntime } from '../../shared/browser-runtime.js';
import { installPageCommentsRuntime } from '../../content/page-comments-runtime.js';
import { createControlActivityState, reduceControlActivity } from './control-activity-state.js';
import { installConversationWorkspaceObservers } from './conversation-workspace-observers.js';
import { ConversationWorkspaceService } from './conversation-workspace-service.js';
import { createChromeConversationWorkspaceStore } from './conversation-workspaces.js';
import { nativeHostDisconnectState } from './native-host-readiness.js';
import { PageCommentService } from './page-comments.js';

const BROWSER_ID_KEY = 'panerelay.browserId';
const RECONNECT_DELAY_MS = 2_000;
const AGENT_REQUEST_TIMEOUT_MS = 60_000;
const INTEGRATION_REQUEST_TIMEOUT_MS = 5_000;

interface PendingRequest<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type PendingAgentRequest = PendingRequest<unknown>;
type PendingIntegrationRequest = PendingRequest<IntegrationResult>;

export interface CollaborationBackgroundOptions {
  automation: BrowserAutomationCapability;
  automationHostMessageTypes: readonly HostToExtensionMessage['type'][];
  automationUnavailableMessage: string;
  automationAdapter?: CollaborationAutomationAdapter;
  browserRuntime: BrowserRuntime;
}

export interface CollaborationAutomationSnapshot {
  authorizationRequest: 'all-tabs' | null;
  authorizationMode: AuthorizationMode;
  authorizedOriginPatterns: string[];
  authorizedTab: TabSummary | null;
  automation: BrowserAutomationCapability;
  automationMessage?: string;
  controlledTab: TabSummary | null;
  controlledTabs: TabSummary[];
}

export interface CollaborationAutomationContext {
  activeTab: () => Promise<TabSummary | null>;
  broadcastStatus: () => Promise<void>;
  registerBrowser: () => Promise<void>;
  sendNative: (message: unknown) => void;
  summarizeTab: (tab: chrome.tabs.Tab) => TabSummary | null;
}

export interface CollaborationAutomationAdapter {
  closeTarget?: (tabId: number, context: CollaborationAutomationContext) => Promise<void>;
  handleHostMessage?: (
    message: HostToExtensionMessage,
    context: CollaborationAutomationContext,
  ) => Promise<boolean>;
  handleRuntimeMessage?: (
    message: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
    context: CollaborationAutomationContext,
  ) => boolean;
  onPermissionsRemoved?: (context: CollaborationAutomationContext) => void;
  onNativeDisconnected?: (context: CollaborationAutomationContext) => void | Promise<void>;
  onNavigationTargetCreated?: (
    sourceTabId: number,
    tabId: number,
    context: CollaborationAutomationContext,
  ) => void;
  onTabActivated?: (tabId: number, context: CollaborationAutomationContext) => void;
  onTabCreated?: (tab: chrome.tabs.Tab, context: CollaborationAutomationContext) => void;
  onTabRemoved?: (tabId: number, context: CollaborationAutomationContext) => void;
  onTabUpdated?: (
    tabId: number,
    changeInfo: { status?: string; title?: string; url?: string },
    tab: chrome.tabs.Tab,
    context: CollaborationAutomationContext,
  ) => void;
  setAuthorization: (
    mode: AuthorizationMode,
    context: CollaborationAutomationContext,
  ) => Promise<void>;
  snapshot: () => Promise<CollaborationAutomationSnapshot>;
  start?: (context: CollaborationAutomationContext) => void | Promise<void>;
  activateTarget?: (tabId: number, context: CollaborationAutomationContext) => Promise<void>;
}

function isCollaborationHostMessage(
  value: unknown,
  automationHostMessageTypes: readonly HostToExtensionMessage['type'][],
): value is HostToExtensionMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const commonTypes: readonly HostToExtensionMessage['type'][] = [
    'browser.registered',
    'control.session.changed',
    'control.activity.snapshot',
    'control.activity.updated',
    'agent.response',
    'integration.response',
    'conversation.event',
  ];
  return (
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof candidate.type === 'string' &&
    [...commonTypes, ...automationHostMessageTypes].includes(
      candidate.type as HostToExtensionMessage['type'],
    )
  );
}

export function startCollaborationBackground(options: CollaborationBackgroundOptions): void {
  let nativePort: chrome.runtime.Port | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let nativeHostState: NativeHostState = 'connecting';
  let defaultProvider: DefaultProviderState | null = null;
  let lastError: string | undefined;
  let nativeTransferCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  let controlActivityState = createControlActivityState();
  const pendingAgentRequests = new Map<string, PendingAgentRequest>();
  const pendingIntegrationRequests = new Map<string, PendingIntegrationRequest>();
  const nativeTransferReceiver = new NativeTransferReceiver();
  const conversationWorkspaceStore = createChromeConversationWorkspaceStore();
  const defaultAutomationSnapshot = (): CollaborationAutomationSnapshot => ({
    authorizationRequest: null,
    authorizationMode: 'none',
    authorizedOriginPatterns: [],
    authorizedTab: null,
    automation: options.automation,
    controlledTab: null,
    controlledTabs: [],
  });

  function summarizeTab(tab: chrome.tabs.Tab): TabSummary | null {
    if (typeof tab.id !== 'number') return null;
    return {
      id: tab.id,
      title: tab.title || 'Untitled tab',
      url: tab.url || '',
    };
  }

  async function activeTab(): Promise<TabSummary | null> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab ? summarizeTab(tab) : null;
  }

  async function isTabOriginAuthorized(tab: TabSummary): Promise<boolean> {
    const origin = originAuthorizationForUrl(tab.url);
    if (!origin) return false;
    return chrome.permissions.contains({ origins: [origin.permissionPattern] });
  }

  const conversationWorkspaceService = new ConversationWorkspaceService({
    activeTabId: async () => (await activeTab())?.id ?? null,
    activeTabContext: async tabId => {
      const tab = await chrome.tabs.get(tabId);
      return {
        ...(tab.url ? { url: tab.url.slice(0, 4_000) } : {}),
        ...(tab.title ? { title: tab.title.slice(0, 500) } : {}),
      };
    },
    requestAgent,
    store: conversationWorkspaceStore,
  });
  const pageCommentService = new PageCommentService({
    broadcastReset: async () => {
      await chrome.runtime
        .sendMessage({ type: 'panerelay.page-comment.reset' })
        .catch(() => undefined);
    },
    ensureRuntime: async tabId => {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: installPageCommentsRuntime,
        });
        return results.length > 0 && results.every(result => result.result === true);
      } catch {
        return false;
      }
    },
    isAuthorized: isTabOriginAuthorized,
    resolveActiveTab: activeTab,
    sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  });

  async function status(): Promise<ExtensionStatus> {
    const automation = options.automationAdapter
      ? await options.automationAdapter.snapshot()
      : defaultAutomationSnapshot();
    return {
      bridgeConnected: nativeHostState === 'connected',
      nativeHostState,
      defaultProvider,
      authorizationRequest: automation.authorizationRequest,
      activeTab: await activeTab(),
      authorizationMode: automation.authorizationMode,
      authorizedOriginPatterns: [...automation.authorizedOriginPatterns],
      authorizedTab: automation.authorizedTab,
      controlledTab: automation.controlledTab,
      controlledTabs: [...automation.controlledTabs],
      controlSession: controlActivityState.session,
      automationActivities: [...controlActivityState.activities],
      automationHistoryGap: controlActivityState.historyGap,
      browserFamily: options.browserRuntime.browserFamily,
      automationAvailable:
        automation.automation.ready && automation.automation.transport !== 'none',
      ...(lastError ? { error: lastError } : {}),
      ...(!lastError && automation.automationMessage
        ? { automationMessage: automation.automationMessage }
        : {}),
    };
  }

  async function broadcastStatus(): Promise<void> {
    const message: StatusChangedMessage = {
      type: 'panerelay.status.changed',
      status: await status(),
    };
    await chrome.runtime.sendMessage(message).catch(() => undefined);
  }

  async function broadcastWorkspaceForTab(
    tabId: number,
    workspace?: ConversationWorkspaceSnapshot,
  ): Promise<void> {
    const current = await activeTab();
    if (current?.id !== tabId) return;
    const message: ConversationWorkspaceChangedMessage = {
      type: 'panerelay.workspace.changed',
      workspace: workspace ?? (await conversationWorkspaceStore.get(tabId)),
    };
    await chrome.runtime.sendMessage(message).catch(() => undefined);
  }

  function sendNative(message: unknown): void {
    if (!nativePort) throw new Error('Panerelay Bridge is disconnected');
    const frames = encodeNativeTransfer(message);
    const transferFrame = frames.find(isNativeTransferEnvelope);
    try {
      for (const frame of frames) nativePort.postMessage(frame);
    } catch (error) {
      if (transferFrame?.type === 'transport.chunk') {
        try {
          nativePort.postMessage(
            createNativeTransferCancel(transferFrame.transferId, 'Extension transport failed'),
          );
        } catch {
          // The Native Messaging channel is already unavailable.
        }
      }
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  function scheduleNativeTransferCleanup(): void {
    if (nativeTransferCleanupTimer || nativeTransferReceiver.pendingCount === 0) return;
    nativeTransferCleanupTimer = setTimeout(() => {
      nativeTransferCleanupTimer = null;
      for (const transferId of nativeTransferReceiver.expire()) {
        try {
          sendNative(
            createNativeTransferCancel(
              transferId,
              'Native Messaging transfer timed out before all chunks arrived',
            ),
          );
        } catch {
          // Disconnect cleanup clears the remaining transfer state.
        }
      }
      scheduleNativeTransferCleanup();
    }, PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS);
  }

  async function browserId(): Promise<string> {
    const stored = await chrome.storage.local.get(BROWSER_ID_KEY);
    if (typeof stored[BROWSER_ID_KEY] === 'string') return stored[BROWSER_ID_KEY];
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ [BROWSER_ID_KEY]: id });
    return id;
  }

  async function registerBrowser(): Promise<void> {
    const automation = options.automationAdapter
      ? (await options.automationAdapter.snapshot()).automation
      : options.automation;
    sendNative({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: await browserId(),
      browserName: options.browserRuntime.browserName,
      extensionId: chrome.runtime.id,
      extensionVersion: chrome.runtime.getManifest().version,
      browserFamily: options.browserRuntime.browserFamily,
      capabilities: {
        cdpRelay: automation.transport === 'cdp' && automation.ready,
        automation,
      },
    });
  }

  const automationContext: CollaborationAutomationContext = {
    activeTab,
    broadcastStatus,
    registerBrowser,
    sendNative,
    summarizeTab,
  };

  function rejectPendingRequests(reason: string): void {
    for (const pending of [
      ...pendingAgentRequests.values(),
      ...pendingIntegrationRequests.values(),
    ]) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    pendingAgentRequests.clear();
    pendingIntegrationRequests.clear();
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectNativeHost();
    }, RECONNECT_DELAY_MS);
  }

  function connectNativeHost(): void {
    if (nativePort) return;
    try {
      const port = chrome.runtime.connectNative(PANERELAY_NATIVE_HOST_NAME);
      nativePort = port;
      lastError = undefined;
      port.onMessage.addListener((frame: unknown) => {
        try {
          for (const message of nativeTransferReceiver.push(frame)) {
            if (isCollaborationHostMessage(message, options.automationHostMessageTypes)) {
              void handleHostMessage(message);
            }
          }
          scheduleNativeTransferCleanup();
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          void broadcastStatus();
        }
      });
      port.onDisconnect.addListener(() => {
        if (nativePort !== port) return;
        const error = chrome.runtime.lastError;
        nativePort = null;
        lastError = error?.message || 'Panerelay Bridge disconnected';
        nativeHostState = nativeHostDisconnectState(lastError);
        defaultProvider = null;
        nativeTransferReceiver.cancelAll();
        if (nativeTransferCleanupTimer) {
          clearTimeout(nativeTransferCleanupTimer);
          nativeTransferCleanupTimer = null;
        }
        rejectPendingRequests(lastError);
        void Promise.resolve(options.automationAdapter?.onNativeDisconnected?.(automationContext))
          .catch(() => undefined)
          .finally(broadcastStatus);
        scheduleReconnect();
      });
      void registerBrowser().then(broadcastStatus);
    } catch (error) {
      nativePort = null;
      lastError = error instanceof Error ? error.message : String(error);
      nativeHostState = nativeHostDisconnectState(lastError);
      defaultProvider = null;
      void broadcastStatus();
      scheduleReconnect();
    }
  }

  async function handleHostMessage(message: HostToExtensionMessage): Promise<void> {
    if (
      options.automationAdapter?.handleHostMessage &&
      (await options.automationAdapter.handleHostMessage(message, automationContext))
    ) {
      return;
    }
    switch (message.type) {
      case 'browser.registered':
        nativeHostState = 'connected';
        lastError = undefined;
        await broadcastStatus();
        void refreshDefaultProvider();
        return;
      case 'control.session.changed':
      case 'control.activity.snapshot':
      case 'control.activity.updated':
        controlActivityState = reduceControlActivity(controlActivityState, message);
        await broadcastStatus();
        return;
      case 'agent.response':
        handleAgentResponse(message);
        return;
      case 'integration.response':
        handleIntegrationResponse(message);
        return;
      case 'conversation.event':
        await chrome.runtime
          .sendMessage({
            type: 'panerelay.conversation.event',
            event: message.event,
          } satisfies ConversationChangedMessage)
          .catch(() => undefined);
        return;
    }
  }

  function handleAgentResponse(message: AgentResponseMessage): void {
    const pending = pendingAgentRequests.get(message.requestId);
    if (!pending) return;
    pendingAgentRequests.delete(message.requestId);
    clearTimeout(pending.timer);
    if (message.success) pending.resolve(message.result);
    else pending.reject(new Error(message.error || 'Agent request failed'));
  }

  function requestAgent(request: AgentRequest): Promise<unknown> {
    const requestId = crypto.randomUUID();
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingAgentRequests.delete(requestId);
        reject(new Error(`Timed out waiting for ${request.method}`));
      }, AGENT_REQUEST_TIMEOUT_MS);
      pendingAgentRequests.set(requestId, { resolve, reject, timer });
    });
    try {
      sendNative({
        type: 'agent.request',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        request,
      });
    } catch (error) {
      const pending = pendingAgentRequests.get(requestId);
      if (pending) clearTimeout(pending.timer);
      pendingAgentRequests.delete(requestId);
      return Promise.reject(error);
    }
    return result;
  }

  function handleIntegrationResponse(message: IntegrationResponseMessage): void {
    const pending = pendingIntegrationRequests.get(message.requestId);
    if (!pending) return;
    pendingIntegrationRequests.delete(message.requestId);
    clearTimeout(pending.timer);
    if (message.success && message.result) pending.resolve(message.result);
    else pending.reject(new Error(message.error || 'Integration request failed'));
  }

  function requestIntegration(
    request: Extract<IntegrationRequest, { method: `default-provider.${string}` }>,
  ): Promise<IntegrationDefaultProviderResult>;
  function requestIntegration(
    request: Extract<IntegrationRequest, { method: 'workspace.pick-directory' }>,
  ): Promise<IntegrationWorkspaceDirectoryResult>;
  function requestIntegration(request: IntegrationRequest): Promise<IntegrationResult> {
    const requestId = crypto.randomUUID();
    const result = new Promise<IntegrationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingIntegrationRequests.delete(requestId);
        reject(new Error(`Timed out waiting for ${request.method}`));
      }, INTEGRATION_REQUEST_TIMEOUT_MS);
      pendingIntegrationRequests.set(requestId, { resolve, reject, timer });
    });
    try {
      sendNative({
        type: 'integration.request',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        request,
      });
    } catch (error) {
      const pending = pendingIntegrationRequests.get(requestId);
      if (pending) clearTimeout(pending.timer);
      pendingIntegrationRequests.delete(requestId);
      return Promise.reject(error);
    }
    return result;
  }

  async function refreshDefaultProvider(): Promise<void> {
    try {
      defaultProvider = await requestIntegration({ method: 'default-provider.get' });
    } catch {
      defaultProvider = null;
    }
    await broadcastStatus();
  }

  async function retryNativeHost(): Promise<ExtensionStatus> {
    if (!nativePort) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      nativeHostState = 'connecting';
      lastError = undefined;
      await broadcastStatus();
      connectNativeHost();
    }
    return status();
  }

  async function setDefaultProvider(enabled: boolean): Promise<ExtensionStatus> {
    defaultProvider = await requestIntegration({
      method: enabled ? 'default-provider.set' : 'default-provider.clear',
    });
    await broadcastStatus();
    return status();
  }

  async function handleSidePanelRequest(message: SidePanelRequest): Promise<SidePanelResponse> {
    switch (message.type) {
      case 'panerelay.status.get':
        return { success: true, status: await status() };
      case 'panerelay.authorization.set':
        if (options.automationAdapter) {
          await options.automationAdapter.setAuthorization(message.mode, automationContext);
          return { success: true, status: await status() };
        }
        if (message.mode !== ('none' satisfies AuthorizationMode))
          throw new Error(options.automationUnavailableMessage);
        return { success: true, status: await status() };
      case 'panerelay.native.retry':
        return { success: true, status: await retryNativeHost() };
      case 'panerelay.default-provider.set':
        return { success: true, status: await setDefaultProvider(message.enabled) };
      case 'panerelay.controlled-tab.activate':
        if (options.automationAdapter?.activateTarget) {
          await options.automationAdapter.activateTarget(message.tabId, automationContext);
          return { success: true, status: await status() };
        }
        throw new Error(options.automationUnavailableMessage);
      case 'panerelay.controlled-tab.close':
        if (options.automationAdapter?.closeTarget) {
          await options.automationAdapter.closeTarget(message.tabId, automationContext);
          return { success: true, status: await status() };
        }
        throw new Error(options.automationUnavailableMessage);
      case 'panerelay.agent.providers':
        return {
          success: true,
          providers: (await requestAgent({ method: 'agent.providers' })) as AgentProviderSummary[],
        };
      case 'panerelay.agent.prepare':
        await requestAgent({ method: 'agent.prepare', providerId: message.providerId });
        return { success: true };
      case 'panerelay.workspace.get':
        return {
          success: true,
          workspace: await conversationWorkspaceService.get(message.providerId),
        };
      case 'panerelay.workspace.reset':
        return {
          success: true,
          workspace: await conversationWorkspaceService.reset(
            message.providerId,
            message.expectedRevision,
          ),
        };
      case 'panerelay.workspace.pick-directory': {
        const selected = await requestIntegration({ method: 'workspace.pick-directory' });
        if (!selected.path) return { success: true };
        return {
          success: true,
          workspace: await conversationWorkspaceService.setDirectory(
            message.expectedRevision,
            selected.path,
          ),
        };
      }
      case 'panerelay.workspace.clear-directory':
        return {
          success: true,
          workspace: await conversationWorkspaceService.setDirectory(message.expectedRevision),
        };
      case 'panerelay.page-comments.start':
        await pageCommentService.start(message.continuous === true, message.locale, message.theme);
        return { success: true };
      case 'panerelay.page-comments.stop':
        await pageCommentService.stop();
        return { success: true };
      case 'panerelay.page-comments.edit':
        await pageCommentService.edit(message.commentId);
        return { success: true };
      case 'panerelay.page-comments.remove':
        await pageCommentService.remove(message.commentId);
        return { success: true };
      case 'panerelay.page-comments.clear':
        await pageCommentService.clear();
        return { success: true };
      case 'panerelay.conversation.list':
        return {
          success: true,
          conversations: (await requestAgent({
            method: 'conversation.list',
            providerId: message.providerId,
            ...(message.cwd ? { cwd: message.cwd } : {}),
          })) as ConversationSummary[],
        };
      case 'panerelay.conversation.resume':
        return {
          success: true,
          ...(await conversationWorkspaceService.resume(
            message.providerId,
            message.conversationId,
            message.expectedRevision,
          )),
        };
      case 'panerelay.conversation.send':
        return {
          success: true,
          ...(await conversationWorkspaceService.send(
            message.providerId,
            message.expectedRevision,
            message.text,
            message.conversationId,
            message.images,
          )),
        };
      case 'panerelay.conversation.interrupt':
        await requestAgent({
          method: 'conversation.interrupt',
          providerId: message.providerId,
          conversationId: message.conversationId,
          turnId: message.turnId,
        });
        return { success: true };
      case 'panerelay.conversation.respond':
        await requestAgent({
          method: 'conversation.respond',
          providerId: message.providerId,
          conversationId: message.conversationId,
          approvalId: message.approvalId,
          decision: message.decision,
        });
        return { success: true };
    }
  }

  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return false;
    const type = (message as { type?: unknown }).type;
    if (typeof type !== 'string' || !type.startsWith('panerelay.')) return false;
    const runtimeMessage = message as Record<string, unknown>;
    if (
      options.automationAdapter?.handleRuntimeMessage?.(runtimeMessage, sender, automationContext)
    ) {
      return false;
    }
    if (runtimeMessage.source === 'panerelay-page-comments' && typeof sender.tab?.id === 'number') {
      const tabId = sender.tab.id;
      if (type === 'panerelay.page-comment.picker-paused') {
        void chrome.tabs
          .sendMessage(tabId, { type: 'panerelay.page-comments.pause' })
          .catch(() => undefined);
      } else if (type === 'panerelay.page-comment.picker-resumed') {
        void chrome.tabs
          .sendMessage(tabId, { type: 'panerelay.page-comments.resume' })
          .catch(() => undefined);
      } else if (
        type === 'panerelay.page-comment.frame-active' &&
        typeof runtimeMessage.frameToken === 'string' &&
        runtimeMessage.frameToken.length <= 100
      ) {
        void chrome.tabs
          .sendMessage(tabId, {
            type: 'panerelay.page-comments.frame-active',
            frameToken: runtimeMessage.frameToken,
          })
          .catch(() => undefined);
      } else if (type === 'panerelay.page-comment.mode' && runtimeMessage.active === false) {
        void chrome.tabs
          .sendMessage(tabId, { type: 'panerelay.page-comments.stop' })
          .catch(() => undefined);
      }
    }
    if (
      type === 'panerelay.status.changed' ||
      type === 'panerelay.conversation.event' ||
      type === 'panerelay.workspace.changed' ||
      type.startsWith('panerelay.page-comment.')
    ) {
      return false;
    }

    void handleSidePanelRequest(message as SidePanelRequest)
      .then(sendResponse)
      .catch(error =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies SidePanelResponse),
      );
    return true;
  });

  chrome.tabs.onRemoved.addListener(tabId => {
    options.automationAdapter?.onTabRemoved?.(tabId, automationContext);
    void pageCommentService.resetIfDocumentEnded(tabId);
  });
  chrome.tabs.onCreated.addListener(tab => {
    options.automationAdapter?.onTabCreated?.(tab, automationContext);
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    options.automationAdapter?.onTabActivated?.(tabId, automationContext);
    void pageCommentService.resetIfTabChanged(tabId);
    void broadcastStatus();
    void broadcastWorkspaceForTab(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    options.automationAdapter?.onTabUpdated?.(tabId, changeInfo, tab, automationContext);
    if (changeInfo.status === 'loading' || changeInfo.url) {
      void pageCommentService.resetIfDocumentEnded(tabId);
    }
    if (changeInfo.url || changeInfo.title) void broadcastStatus();
  });
  chrome.permissions.onRemoved.addListener(() => {
    options.automationAdapter?.onPermissionsRemoved?.(automationContext);
    void pageCommentService.reset();
    void broadcastStatus();
  });
  chrome.webNavigation.onCreatedNavigationTarget.addListener(({ sourceTabId, tabId }) => {
    options.automationAdapter?.onNavigationTargetCreated?.(sourceTabId, tabId, automationContext);
  });

  installConversationWorkspaceObservers(conversationWorkspaceStore, {
    onInherited: broadcastWorkspaceForTab,
  });
  void Promise.resolve(options.automationAdapter?.start?.(automationContext))
    .catch(error => {
      lastError = error instanceof Error ? error.message : String(error);
    })
    .finally(connectNativeHost);
}
