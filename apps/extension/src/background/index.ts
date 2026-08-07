import {
  PANERELAY_NATIVE_HOST_NAME,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isHostToExtensionMessage,
  isNativeTransferEnvelope,
  type AgentRequest,
  type AgentResponseMessage,
  type AutomationEngineId,
  type AutomationIntegrationId,
  type CdpCommandMessage,
  type CdpTargetInfo,
  type CdpTargetRequestMessage,
  type BrowserFetchRequestMessage,
  type BrowserFetchPermissionRequestMessage,
  type HostToExtensionMessage,
  type IntegrationRequest,
  type IntegrationBrowserDefaultResult,
  type IntegrationBrowserUseDefaultResult,
  type IntegrationDefaultProviderResult,
  type IntegrationInstallResult,
  type IntegrationResponseMessage,
  type IntegrationResult,
  type IntegrationWorkspaceDirectoryResult,
} from '@panerelay/protocol';
import { controlBadgeBackground, controlBadgeText } from './action-badge.js';
import { createControlActivityState, reduceControlActivity } from './control-activity-state.js';
import type {
  AuthorizationMode,
  ConversationChangedMessage,
  ConversationWorkspaceChangedMessage,
  DefaultProviderState,
  ExtensionStatus,
  HostReleaseStatus,
  NativeHostState,
  SidePanelRequest,
  SidePanelResponse,
  StatusChangedMessage,
  TabSummary,
} from '../shared/messages.js';
import {
  ALL_WEB_ORIGIN_PATTERNS,
  isOriginEligible,
  originAuthorizationForUrl,
} from '../shared/authorization.js';
import {
  applyControlledFavicon,
  releaseControlledFavicon,
  replaceControlledFaviconEngine,
} from './controlled-favicon.js';
import { cdpCommandTouchesDocument } from './cdp-document-activity.js';
import { debuggerDetachReason } from './debugger-detach.js';
import {
  TargetExposureState,
  TargetPublicationQueue,
  targetInfoEquals,
} from './target-publication.js';
import { installConversationWorkspaceObservers } from './conversation-workspace-observers.js';
import { ConversationWorkspaceService } from './conversation-workspace-service.js';
import { createChromeConversationWorkspaceStore } from './conversation-workspaces.js';
import { createChromeConversationTimelineStore } from './conversation-timelines.js';
import type { ConversationWorkspaceSnapshot } from '../shared/conversation-workspaces.js';
import {
  hostReleaseAfterDisconnect,
  hostReleaseAfterRegistration,
  nativeHostBridgeReady,
  nativeHostDisconnectPreservesAuthorization,
  nativeHostDisconnectState,
} from './native-host-readiness.js';
import { installPageCommentsRuntime } from '../content/page-comments-runtime.js';
import { PAGE_COMMENT_RUNTIME_ASSETS } from '../content/page-comments-runtime-assets.js';
import { PageCommentService } from './page-comments.js';
import { detectBrowserRuntime } from '../shared/browser-runtime.js';
import { PendingRequestTracker } from './pending-request-tracker.js';
import { createSidePanelRequestRouter } from './sidepanel-request-router.js';
import { ACCENT_COLOR_KEY } from '../shared/appearance.js';
import { installReleaseActionContextMenu } from './action-context-menu.js';
import { extensionManifestIdentity } from '../shared/manifest-identity.js';
import { createHostUpdateCheck } from './host-update-check.js';
import {
  createChromeBrowserFetchEnvironment,
  executeBrowserFetch,
  removeAbandonedBrowserFetchRules,
} from './browser-fetch.js';
import {
  assertFetchUrlAuthorized,
  fetchPermissionPatterns,
  grantFetchDomain,
  readFetchAuthorization,
  revokeFetchDomain,
  setFetchAllDomains,
} from '../shared/fetch-permissions.js';
import { FetchPermissionRequestManager } from './fetch-permission-requests.js';

const BROWSER_ID_KEY = 'panerelay.browserId';
const ALL_TABS_AUTHORIZATION_KEY = 'panerelay.authorization.allTabs';
const RECONNECT_DELAY_MS = 2_000;
const AGENT_REQUEST_TIMEOUT_MS = 60_000;
const INTEGRATION_REQUEST_TIMEOUT_MS = 5_000;
const INTEGRATION_INSTALL_REQUEST_TIMEOUT_MS = 5 * 60_000 + 10_000;
const browserRuntime = detectBrowserRuntime();
const browserFetchEnvironment = createChromeBrowserFetchEnvironment();
const browserFetchStartupCleanup = removeAbandonedBrowserFetchRules().catch(() => undefined);
const fetchPermissionRequests = new FetchPermissionRequestManager();

let nativePort: chrome.runtime.Port | null = null;
let browserRegistered = false;
const consumeHostUpdateCheck = createHostUpdateCheck();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let nativeHostState: NativeHostState = 'connecting';
let hostReleaseStatus: HostReleaseStatus = { state: 'checking', retryAvailable: false };
let defaultProvider: DefaultProviderState | null = null;
let browserUseDefault: IntegrationBrowserUseDefaultResult | null = null;
let browserDefault: IntegrationBrowserDefaultResult | null = null;
let authorizationRequest: 'all-tabs' | null = null;
let authorizationMode: AuthorizationMode = 'none';
let authorizedOriginPatterns: string[] = [];
let authorizedTab: TabSummary | null = null;
let lastError: string | undefined;
let targetDiscoveryActive = false;
const targetIdsByTabId = new Map<number, string>();
const tabIdsByTargetId = new Map<string, number>();
const attachedTabs = new Map<string, TabSummary>();
const controlledTabs = new Map<string, TabSummary>();
const controlledFaviconEngines = new Map<string, AutomationEngineId>();
const controlledFaviconTasks = new Map<string, Promise<void>>();
const publishedTargets = new Map<string, CdpTargetInfo>();
const sessionOwnedTabIds = new Set<number>();
const targetExposure = new TargetExposureState();
const targetPublicationQueue = new TargetPublicationQueue();
const pendingAgentRequests = new PendingRequestTracker<unknown>(AGENT_REQUEST_TIMEOUT_MS);
const pendingIntegrationRequests = new PendingRequestTracker<IntegrationResult>(
  INTEGRATION_REQUEST_TIMEOUT_MS,
);
const nativeTransferReceiver = new NativeTransferReceiver();
let nativeTransferCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let controlActivityState = createControlActivityState();
const conversationWorkspaceStore = createChromeConversationWorkspaceStore();
const conversationTimelineStore = createChromeConversationTimelineStore();
const conversationWorkspaceService = new ConversationWorkspaceService({
  activeTabId: async () => (await activeTab())?.id ?? null,
  activeTabContext: async tabId => {
    const tab = await chrome.tabs.get(tabId);
    return {
      ...(tab.url ? { url: tab.url.slice(0, 4_000) } : {}),
      ...(tab.title ? { title: tab.title.slice(0, 500) } : {}),
      target: {
        browserId: await browserId(),
        targetId: targetIdForTabId(tabId),
      },
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
        args: [PAGE_COMMENT_RUNTIME_ASSETS],
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
const handleSidePanelRequest = createSidePanelRequestRouter({
  activateControlledTab,
  closeControlledTab,
  pageComments: pageCommentService,
  timelines: conversationTimelineStore,
  releaseControl: releaseBrowserControl,
  refreshBrowserDefault,
  refreshBrowserUseDefault,
  requestAgent,
  retryNativeHost,
  retryHostUpdate,
  selectWorkspaceDirectory: async () =>
    (await requestIntegration({ method: 'workspace.pick-directory' })).path,
  setAuthorization,
  setFetchAuthorization,
  setBrowserDefault,
  setBrowserUseDefault,
  setDefaultProvider,
  installIntegration,
  status,
  workspace: conversationWorkspaceService,
});

async function updateActionBadge(): Promise<void> {
  const stored = await chrome.storage.local.get(ACCENT_COLOR_KEY);
  // Leave the text color unset so Chrome chooses black or white to contrast with this background.
  await chrome.action.setBadgeBackgroundColor({
    color: controlBadgeBackground(stored[ACCENT_COLOR_KEY]),
  });
  await chrome.action.setBadgeText({ text: controlBadgeText(controlledTabs.size) });
}

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

async function status(): Promise<ExtensionStatus> {
  const currentActiveTab = await activeTab();
  const controlled = [...controlledTabs.values()];
  const controlledTab =
    controlled.find(tab => tab.id === currentActiveTab?.id) ?? controlled[0] ?? null;
  return {
    bridgeConnected: nativeHostBridgeReady(nativeHostState, browserRegistered),
    nativeHostState,
    hostRelease: { ...hostReleaseStatus },
    defaultProvider,
    browserUseDefault,
    browserDefault,
    authorizationRequest,
    fetchAuthorization: await readFetchAuthorization(),
    activeTab: currentActiveTab,
    authorizationMode,
    authorizedOriginPatterns: [...authorizedOriginPatterns],
    authorizedTab,
    controlledTab,
    controlledTabs: controlled,
    controlSession: controlActivityState.session,
    automationActivities: [...controlActivityState.activities],
    automationHistoryGap: controlActivityState.historyGap,
    ...(lastError ? { error: lastError } : {}),
  };
}

async function broadcastStatus(): Promise<void> {
  const message: StatusChangedMessage = {
    type: 'panerelay.status.changed',
    status: await status(),
  };
  await chrome.runtime.sendMessage(message).catch(() => undefined);
}

function handleDetachedNativeTaskError(
  expectedPort: chrome.runtime.Port | null,
  error: unknown,
): void {
  if (!expectedPort || nativePort !== expectedPort) return;
  lastError = error instanceof Error ? error.message : String(error);
  void broadcastStatus().catch(() => undefined);
}

function reportActionContextMenuError(error: unknown): void {
  lastError = error instanceof Error ? error.message : String(error);
  void broadcastStatus().catch(() => undefined);
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

async function restorePersistentAuthorization(): Promise<void> {
  const stored = await chrome.storage.local.get(ALL_TABS_AUTHORIZATION_KEY);
  if (stored[ALL_TABS_AUTHORIZATION_KEY] !== true) return;
  const granted = await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] });
  if (!granted) {
    await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    return;
  }
  authorizationMode = 'all-tabs';
  authorizedOriginPatterns = [...ALL_WEB_ORIGIN_PATTERNS];
}

async function browserId(): Promise<string> {
  const stored = await chrome.storage.local.get(BROWSER_ID_KEY);
  if (typeof stored[BROWSER_ID_KEY] === 'string') return stored[BROWSER_ID_KEY];

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [BROWSER_ID_KEY]: id });
  return id;
}

async function registerBrowser(): Promise<void> {
  const identity = extensionManifestIdentity();
  const checkHostUpdate = consumeHostUpdateCheck();
  sendNative({
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: await browserId(),
    browserName: browserRuntime.browserName,
    extensionId: chrome.runtime.id,
    releaseVersion: identity.releaseVersion,
    buildVersion: identity.buildVersion,
    checkHostUpdate,
    browserFamily: browserRuntime.browserFamily,
    capabilities: {
      cdpRelay: browserRuntime.cdpRelay,
      browserFetch: true,
    },
  });
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
    browserRegistered = false;
    nativeHostState = 'connected';
    hostReleaseStatus = hostReleaseAfterDisconnect(hostReleaseStatus);
    lastError = undefined;
    port.onMessage.addListener((frame: unknown) => {
      try {
        for (const message of nativeTransferReceiver.push(frame)) {
          if (!isHostToExtensionMessage(message)) continue;
          void handleHostMessage(message).catch(error =>
            handleDetachedNativeTaskError(port, error),
          );
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
      const preserveAuthorization = nativeHostDisconnectPreservesAuthorization(hostReleaseStatus);
      const disconnectMessage = error?.message || 'Panerelay Bridge disconnected';
      nativePort = null;
      browserRegistered = false;
      lastError = preserveAuthorization ? undefined : disconnectMessage;
      nativeHostState = nativeHostDisconnectState(disconnectMessage);
      hostReleaseStatus = hostReleaseAfterDisconnect(hostReleaseStatus);
      defaultProvider = null;
      browserUseDefault = null;
      browserDefault = null;
      nativeTransferReceiver.cancelAll();
      if (nativeTransferCleanupTimer) {
        clearTimeout(nativeTransferCleanupTimer);
        nativeTransferCleanupTimer = null;
      }
      if (!preserveAuthorization && authorizationMode !== 'all-tabs') {
        authorizationMode = 'none';
        authorizedOriginPatterns = [];
      }
      if (!preserveAuthorization) authorizedTab = null;
      pendingAgentRequests.rejectAll(disconnectMessage);
      pendingIntegrationRequests.rejectAll(disconnectMessage);
      fetchPermissionRequests.cancelAll(disconnectMessage);
      void releaseControl('Panerelay Bridge disconnected', false);
      void broadcastStatus();
      scheduleReconnect();
    });
    void registerBrowser()
      .then(broadcastStatus)
      .catch(error => handleDetachedNativeTaskError(port, error));
  } catch (error) {
    nativePort = null;
    browserRegistered = false;
    lastError = error instanceof Error ? error.message : String(error);
    nativeHostState = nativeHostDisconnectState(lastError);
    hostReleaseStatus = hostReleaseAfterDisconnect(hostReleaseStatus);
    defaultProvider = null;
    browserUseDefault = null;
    browserDefault = null;
    void broadcastStatus();
    scheduleReconnect();
  }
}

async function handleHostMessage(message: HostToExtensionMessage): Promise<void> {
  if (
    !browserRegistered &&
    message.type !== 'browser.registered' &&
    message.type !== 'host.update.status'
  ) {
    return;
  }
  switch (message.type) {
    case 'browser.registered':
      browserRegistered = true;
      hostReleaseStatus = hostReleaseAfterRegistration(
        message.hostVersion,
        extensionManifestIdentity().releaseVersion,
      );
      lastError = undefined;
      await broadcastStatus();
      void refreshDefaultProvider();
      void refreshBrowserUseDefault();
      void refreshBrowserDefault();
      return;
    case 'host.update.status':
      hostReleaseStatus = {
        state: message.state,
        hostVersion: message.hostVersion,
        retryAvailable: message.retryAvailable,
        ...(message.targetVersion ? { targetVersion: message.targetVersion } : {}),
        ...(message.state === 'failed'
          ? {
              error: message.error,
              ...(message.detail ? { detail: message.detail } : {}),
              manualCommand: message.manualCommand,
            }
          : {}),
      };
      lastError = undefined;
      await broadcastStatus();
      return;
    case 'cdp.target.request':
      await handleTargetRequest(message);
      return;
    case 'fetch.request':
      await handleBrowserFetch(message);
      return;
    case 'fetch.permission.request':
      await handleBrowserFetchPermission(message);
      return;
    case 'cdp.attach':
      await attachTarget(message.requestId, message.targetId);
      return;
    case 'cdp.command':
      await runCdpCommand(message);
      return;
    case 'cdp.control.updated':
      await updateTargetControl(message.targetId, message.engine);
      return;
    case 'cdp.detach':
      if (message.targetId) {
        await detachTarget(message.targetId, message.reason, false);
      } else {
        await releaseControl(message.reason, false);
      }
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
    case 'conversation.event': {
      const timelineSequence = await conversationTimelineStore
        .append(message.event)
        .catch(() => null);
      const eventMessage: ConversationChangedMessage = {
        type: 'panerelay.conversation.event',
        event: message.event,
        ...(timelineSequence ? { timelineSequence } : {}),
      };
      await chrome.runtime.sendMessage(eventMessage).catch(() => undefined);
      return;
    }
  }
}

async function handleBrowserFetch(message: BrowserFetchRequestMessage): Promise<void> {
  try {
    await browserFetchStartupCleanup;
    if (message.browserId !== (await browserId())) {
      throw new Error('Browser fetch request targets a different browser registration');
    }
    assertFetchUrlAuthorized(message.request.url, await readFetchAuthorization());
    const response = await executeBrowserFetch(message.request, browserFetchEnvironment);
    sendNative({
      type: 'fetch.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      success: true,
      response,
    });
  } catch (error) {
    const detail = (error instanceof Error ? error.message : String(error)).slice(0, 2_048);
    sendNative({
      type: 'fetch.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      success: false,
      error: detail || 'Browser fetch failed',
    });
  }
}

async function handleBrowserFetchPermission(
  message: BrowserFetchPermissionRequestMessage,
): Promise<void> {
  try {
    if (message.browserId !== (await browserId())) {
      throw new Error('Fetch authorization request targets a different browser registration');
    }
    const result = await fetchPermissionRequests.request(message.domain);
    sendNative({
      type: 'fetch.permission.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      granted: result.granted,
      domain: result.domain,
      ...(result.scope ? { scope: result.scope } : {}),
    });
    await broadcastStatus();
  } catch (error) {
    const detail = (error instanceof Error ? error.message : String(error)).slice(0, 2_048);
    sendNative({
      type: 'fetch.permission.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      granted: false,
      domain: message.domain,
      error: detail || 'Browser fetch authorization failed',
    });
  }
}

function handleAgentResponse(message: AgentResponseMessage): void {
  if (message.success) {
    pendingAgentRequests.resolve(message.requestId, message.result);
  } else {
    pendingAgentRequests.reject(
      message.requestId,
      new Error(message.error || 'Agent request failed'),
    );
  }
}

function requestAgent(request: AgentRequest): Promise<unknown> {
  if (!nativeHostBridgeReady(nativeHostState, browserRegistered)) {
    return Promise.reject(new Error('Panerelay Bridge is disconnected'));
  }
  return pendingAgentRequests.request(request.method, requestId => {
    sendNative({
      type: 'agent.request',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      request,
    });
  });
}

function handleIntegrationResponse(message: IntegrationResponseMessage): void {
  if (message.success && message.result) {
    pendingIntegrationRequests.resolve(message.requestId, message.result);
  } else {
    pendingIntegrationRequests.reject(
      message.requestId,
      new Error(message.error || 'Integration request failed'),
    );
  }
}

function requestIntegration(
  request: Extract<IntegrationRequest, { method: 'integration.install' }>,
): Promise<IntegrationInstallResult>;
function requestIntegration(
  request: Extract<IntegrationRequest, { method: `default-provider.${string}` }>,
): Promise<IntegrationDefaultProviderResult>;
function requestIntegration(
  request: Extract<IntegrationRequest, { method: `browser-default.${string}` }>,
): Promise<IntegrationBrowserDefaultResult>;
function requestIntegration(
  request: Extract<IntegrationRequest, { method: `browser-use-default.${string}` }>,
): Promise<IntegrationBrowserUseDefaultResult>;
function requestIntegration(
  request: Extract<IntegrationRequest, { method: 'workspace.pick-directory' }>,
): Promise<IntegrationWorkspaceDirectoryResult>;
function requestIntegration(request: IntegrationRequest): Promise<IntegrationResult> {
  if (!nativeHostBridgeReady(nativeHostState, browserRegistered)) {
    return Promise.reject(new Error('Panerelay Bridge is disconnected'));
  }
  return pendingIntegrationRequests.request(
    request.method,
    requestId => {
      sendNative({
        type: 'integration.request',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        request,
      });
    },
    request.method === 'integration.install'
      ? INTEGRATION_INSTALL_REQUEST_TIMEOUT_MS
      : INTEGRATION_REQUEST_TIMEOUT_MS,
  );
}

async function refreshDefaultProvider(): Promise<void> {
  try {
    defaultProvider = await requestIntegration({ method: 'default-provider.get' });
  } catch {
    defaultProvider = null;
  }
  await broadcastStatus();
}

async function refreshBrowserDefault(): Promise<void> {
  try {
    browserDefault = await requestIntegration({ method: 'browser-default.get' });
  } catch {
    browserDefault = null;
  }
  await broadcastStatus();
}

async function refreshBrowserUseDefault(): Promise<void> {
  try {
    browserUseDefault = await requestIntegration({ method: 'browser-use-default.get' });
  } catch {
    browserUseDefault = null;
  }
  await broadcastStatus();
}

async function isTabOriginAuthorized(tab: TabSummary): Promise<boolean> {
  if (!isOriginEligible(tab.url, authorizationMode, authorizedOriginPatterns)) return false;
  const origin = originAuthorizationForUrl(tab.url);
  if (!origin) return false;
  return chrome.permissions.contains({
    origins:
      authorizationMode === 'all-tabs' && origin.origin !== 'file://'
        ? [...ALL_WEB_ORIGIN_PATTERNS]
        : [origin.permissionPattern],
  });
}

function targetIdForTabId(tabId: number): string {
  const existing = targetIdsByTabId.get(tabId);
  if (existing) return existing;
  const targetId = crypto.randomUUID();
  targetIdsByTabId.set(tabId, targetId);
  tabIdsByTargetId.set(targetId, tabId);
  return targetId;
}

function forgetTarget(targetId: string): void {
  const tabId = tabIdsByTargetId.get(targetId);
  if (tabId !== undefined) {
    targetIdsByTabId.delete(tabId);
    sessionOwnedTabIds.delete(tabId);
  }
  tabIdsByTargetId.delete(targetId);
  attachedTabs.delete(targetId);
  publishedTargets.delete(targetId);
  if (controlledTabs.delete(targetId)) {
    if (tabId !== undefined) void restoreTargetFavicon(targetId, tabId);
    void updateActionBadge();
  }
}

function renderTargetFavicon(targetId: string, tabId: number, engine: AutomationEngineId): void {
  if (controlledFaviconEngines.get(targetId) === engine) return;
  controlledFaviconEngines.set(targetId, engine);
  const previous = controlledFaviconTasks.get(targetId) ?? Promise.resolve();
  const task = previous
    .then(async () => {
      const currentEngine = controlledFaviconEngines.get(targetId);
      if (currentEngine) await applyControlledFavicon(tabId, currentEngine);
    })
    .finally(() => {
      if (controlledFaviconTasks.get(targetId) === task) controlledFaviconTasks.delete(targetId);
    });
  controlledFaviconTasks.set(targetId, task);
}

function replaceTargetFavicon(targetId: string, tabId: number, engine: AutomationEngineId): void {
  if (controlledFaviconEngines.get(targetId) === engine) return;
  controlledFaviconEngines.set(targetId, engine);
  const previous = controlledFaviconTasks.get(targetId) ?? Promise.resolve();
  const task = previous
    .then(async () => {
      if (controlledFaviconEngines.get(targetId) !== engine) return;
      const replaced = await replaceControlledFaviconEngine(tabId, engine);
      if (!replaced && controlledFaviconEngines.get(targetId) === engine) {
        controlledFaviconEngines.delete(targetId);
      }
    })
    .finally(() => {
      if (controlledFaviconTasks.get(targetId) === task) controlledFaviconTasks.delete(targetId);
    });
  controlledFaviconTasks.set(targetId, task);
}

async function restoreTargetFavicon(targetId: string, tabId: number): Promise<void> {
  controlledFaviconEngines.delete(targetId);
  const previous = controlledFaviconTasks.get(targetId) ?? Promise.resolve();
  const task = previous
    .then(async () => {
      if (!controlledFaviconEngines.has(targetId)) await releaseControlledFavicon(tabId);
    })
    .finally(() => {
      if (controlledFaviconTasks.get(targetId) === task) controlledFaviconTasks.delete(targetId);
    });
  controlledFaviconTasks.set(targetId, task);
  await task;
}

function isSessionOwnedBlankTab(tab: TabSummary): boolean {
  return sessionOwnedTabIds.has(tab.id) && (tab.url === '' || tab.url === 'about:blank');
}

async function isTabEligible(tab: TabSummary): Promise<boolean> {
  if (authorizationMode === 'single-tab' && authorizedTab?.id !== tab.id) return false;
  if (authorizationMode === 'all-tabs' && isSessionOwnedBlankTab(tab)) return true;
  return isTabOriginAuthorized(tab);
}

async function targetInfo(tab: TabSummary, preferredActiveTabId?: number): Promise<CdpTargetInfo> {
  const targetId = targetIdForTabId(tab.id);
  const currentActiveTab = preferredActiveTabId === undefined ? await activeTab() : null;
  return {
    targetId,
    type: 'page',
    title: tab.title,
    url: tab.url,
    attached: attachedTabs.has(targetId),
    active: preferredActiveTabId === tab.id || currentActiveTab?.id === tab.id,
  };
}

async function tabForTarget(targetId: string): Promise<TabSummary> {
  const tabId = tabIdsByTargetId.get(targetId);
  if (tabId === undefined) throw new Error('Panerelay target is no longer available');
  const tab = summarizeTab(await chrome.tabs.get(tabId));
  if (!tab) throw new Error('Panerelay target is no longer available');
  return tab;
}

async function listEligibleTargets(): Promise<CdpTargetInfo[]> {
  let tabs: Array<{
    summary: TabSummary;
    active: boolean;
    lastAccessed: number;
  }> = [];
  if (authorizationMode === 'single-tab' && authorizedTab) {
    const currentTab = await chrome.tabs.get(authorizedTab.id);
    const current = summarizeTab(currentTab);
    if (current && (await isTabEligible(current))) {
      tabs = [
        {
          summary: current,
          active: currentTab.active,
          lastAccessed: currentTab.lastAccessed || 0,
        },
      ];
    }
  } else if (authorizationMode === 'all-tabs') {
    for (const tab of await chrome.tabs.query({})) {
      const summary = summarizeTab(tab);
      if (summary && (await isTabEligible(summary))) {
        tabs.push({
          summary,
          active: tab.active,
          lastAccessed: tab.lastAccessed || 0,
        });
      }
    }
  }

  targetExposure.seedEligible(tabs.map(tab => tab.summary.id));
  tabs = tabs.filter(tab => targetExposure.has(tab.summary.id));
  targetDiscoveryActive = true;
  const currentActiveTab = await activeTab();
  const preferred =
    tabs.find(tab => tab.summary.id === currentActiveTab?.id) ??
    [...tabs]
      .filter(tab => tab.active)
      .sort((left, right) => right.lastAccessed - left.lastAccessed)[0] ??
    [...tabs].sort((left, right) => right.lastAccessed - left.lastAccessed)[0];
  tabs.sort((left, right) => {
    if (left.summary.id === preferred?.summary.id) return -1;
    if (right.summary.id === preferred?.summary.id) return 1;
    return 0;
  });
  return Promise.all(tabs.map(tab => targetInfo(tab.summary, preferred?.summary.id)));
}

function sendTargetResult(
  requestId: string,
  result:
    | { success: true; targets?: CdpTargetInfo[]; target?: CdpTargetInfo }
    | { success: false; error: string },
): void {
  if (result.success) {
    for (const target of result.targets ?? (result.target ? [result.target] : [])) {
      publishedTargets.set(target.targetId, target);
    }
  }
  sendNative({
    type: 'cdp.target.result',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId,
    ...result,
  });
}

async function handleTargetRequest(message: CdpTargetRequestMessage): Promise<void> {
  try {
    switch (message.operation.kind) {
      case 'list': {
        sendTargetResult(message.requestId, {
          success: true,
          targets: await listEligibleTargets(),
        });
        return;
      }
      case 'create': {
        if (authorizationMode !== 'all-tabs') {
          authorizationRequest = 'all-tabs';
          throw new Error(
            'Creating a new tab requires all-tabs authorization. Open the Panerelay Chrome Extension, authorize all tabs, then retry.',
          );
        }
        const url = message.operation.url || 'about:blank';
        if (url !== 'about:blank') {
          const origin = originAuthorizationForUrl(url);
          if (
            !origin ||
            !(await chrome.permissions.contains({ origins: [origin.permissionPattern] }))
          ) {
            throw new Error(`Chrome site access for ${origin?.origin || url} is not granted`);
          }
        }
        const tab = await chrome.tabs.create({ url, active: false });
        const summary = summarizeTab(tab);
        if (!summary) throw new Error('Chrome did not create a controllable tab');
        sessionOwnedTabIds.add(summary.id);
        targetExposure.expose(summary.id);
        sendTargetResult(message.requestId, {
          success: true,
          target: await targetInfo(summary),
        });
        return;
      }
      case 'close': {
        const tab = await tabForTarget(message.operation.targetId);
        await chrome.tabs.remove(tab.id);
        sendTargetResult(message.requestId, { success: true });
        return;
      }
      case 'activate': {
        sendTargetResult(message.requestId, {
          success: true,
          target: await targetInfo(await tabForTarget(message.operation.targetId)),
        });
        return;
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Target-scoped failures are returned to the automation client. They do not describe the
    // health of the Extension or Bridge connection and must not surface as a global status error.
    sendTargetResult(message.requestId, { success: false, error: reason });
    await broadcastStatus();
  }
}

async function attachTarget(requestId: string, targetId: string): Promise<void> {
  try {
    const summary = await tabForTarget(targetId);
    if (!(await isTabEligible(summary))) {
      throw new Error(`Chrome site access for ${summary.url || 'this page'} is not granted`);
    }

    if (!attachedTabs.has(targetId)) {
      await chrome.debugger.attach({ tabId: summary.id }, '1.3');
      attachedTabs.set(targetId, summary);
    }
    sendNative({
      type: 'cdp.attached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      success: true,
      target: await targetInfo(summary),
    });
    await broadcastStatus();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // The attach result is the authoritative error channel for this target. Global status remains
    // reserved for connection and initialization failures that need user attention.
    sendNative({
      type: 'cdp.attached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      success: false,
      error: reason,
    });
    await broadcastStatus();
  }
}

async function runCdpCommand(message: CdpCommandMessage): Promise<void> {
  const target = attachedTabs.get(message.targetId);
  if (!target) {
    sendNative({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      error: { code: -32000, message: 'No tab is currently attached' },
    });
    return;
  }
  let current: TabSummary | null;
  try {
    current = summarizeTab(await chrome.tabs.get(target.id));
  } catch {
    current = null;
  }
  if (!current || !(await isTabEligible(current))) {
    sendNative({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      error: { code: -32000, message: 'The attached tab origin is no longer authorized' },
    });
    if (authorizationMode === 'single-tab') {
      await releaseControl('Attached tab origin is no longer authorized', true);
    } else {
      await detachTarget(message.targetId, 'Attached tab origin is no longer authorized', true);
    }
    return;
  }

  try {
    const debuggee = {
      tabId: current.id,
      ...(message.sessionId ? { sessionId: message.sessionId } : {}),
    } as chrome.debugger.Debuggee;
    if (cdpCommandTouchesDocument(message.method)) {
      if (!controlledTabs.has(message.targetId)) {
        controlledTabs.set(message.targetId, current);
        await updateActionBadge();
        await broadcastStatus();
      }
      if (message.engine) renderTargetFavicon(message.targetId, current.id, message.engine);
    }
    const result = await chrome.debugger.sendCommand(
      debuggee,
      message.method as never,
      message.params as never,
    );
    sendNative({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      result: result ?? {},
    });
  } catch (error) {
    sendNative({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function updateTargetControl(
  targetId: string,
  engine: AutomationEngineId | null,
): Promise<void> {
  const current = attachedTabs.get(targetId) ?? controlledTabs.get(targetId);
  if (!current) return;
  if (engine === null) {
    const wasControlled = controlledTabs.delete(targetId);
    await restoreTargetFavicon(targetId, current.id);
    if (wasControlled) {
      await updateActionBadge();
      await broadcastStatus();
    }
    return;
  }

  const becameControlled = !controlledTabs.has(targetId);
  controlledTabs.set(targetId, current);
  replaceTargetFavicon(targetId, current.id, engine);
  if (becameControlled) {
    await updateActionBadge();
    await broadcastStatus();
  }
}

async function detachTarget(targetId: string, reason: string, notifyHost: boolean): Promise<void> {
  const tab = attachedTabs.get(targetId) ?? controlledTabs.get(targetId);
  attachedTabs.delete(targetId);
  controlledTabs.delete(targetId);
  if (tab) {
    await chrome.debugger.detach({ tabId: tab.id }).catch(() => undefined);
    void restoreTargetFavicon(targetId, tab.id);
  }
  await updateActionBadge().catch(() => undefined);
  if (notifyHost) {
    try {
      sendNative({
        type: 'cdp.detached',
        protocol: PANERELAY_PROTOCOL_VERSION,
        reason,
        scope: 'target',
        targetId,
      });
    } catch {
      // A disconnected host already lost the lease.
    }
  }
  await broadcastStatus();
}

async function releaseControl(reason: string, notifyHost: boolean): Promise<void> {
  const targets = new Set([...attachedTabs.keys(), ...controlledTabs.keys()]);
  for (const targetId of targets) await detachTarget(targetId, reason, false);
  targetDiscoveryActive = false;
  targetIdsByTabId.clear();
  tabIdsByTargetId.clear();
  publishedTargets.clear();
  sessionOwnedTabIds.clear();
  targetExposure.clear();
  if (notifyHost) {
    try {
      sendNative({
        type: 'cdp.detached',
        protocol: PANERELAY_PROTOCOL_VERSION,
        reason,
        scope: 'lease',
      });
    } catch {
      // A disconnected host already lost the lease.
    }
  }
  await broadcastStatus();
}

async function setAuthorization(mode: AuthorizationMode): Promise<ExtensionStatus> {
  if (mode !== authorizationMode) {
    await releaseControl('User changed browser authorization', true);
  }

  if (mode === 'single-tab') {
    const tab = await activeTab();
    if (!tab) throw new Error('No active browser tab is available');
    const origin = originAuthorizationForUrl(tab.url);
    if (!origin) {
      throw new Error(`Panerelay cannot control ${tab.url || 'this page'}`);
    }
    if (!(await chrome.permissions.contains({ origins: [origin.permissionPattern] }))) {
      throw new Error(`Chrome site access for ${origin.origin} was not granted`);
    }
    authorizedTab = tab;
    authorizedOriginPatterns = [origin.permissionPattern];
    await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
  } else if (mode === 'all-tabs') {
    if (!(await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] }))) {
      throw new Error('Chrome access to all web origins was not granted');
    }
    authorizedTab = null;
    authorizedOriginPatterns = [...ALL_WEB_ORIGIN_PATTERNS];
    await chrome.storage.local.set({ [ALL_TABS_AUTHORIZATION_KEY]: true });
  } else {
    authorizedTab = null;
    authorizedOriginPatterns = [];
    await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
  }
  authorizationMode = mode;
  authorizationRequest = null;
  lastError = undefined;
  await broadcastStatus();
  return status();
}

async function setFetchAuthorization(
  request: Extract<SidePanelRequest, { type: 'panerelay.fetch-authorization.set' }>,
): Promise<ExtensionStatus> {
  if (request.scope === 'all-domains') {
    if (request.enabled) {
      const origins = fetchPermissionPatterns('all-domains');
      if (!(await chrome.permissions.contains({ origins }))) {
        throw new Error('Chrome access to all web origins was not granted');
      }
    }
    await setFetchAllDomains(request.enabled);
  } else if (request.enabled) {
    const origins = fetchPermissionPatterns('domain', request.domain);
    if (!(await chrome.permissions.contains({ origins }))) {
      throw new Error(`Chrome site access for ${request.domain} was not granted`);
    }
    await grantFetchDomain(request.domain);
  } else {
    await revokeFetchDomain(request.domain);
  }
  lastError = undefined;
  await broadcastStatus();
  return status();
}

async function releaseBrowserControl(): Promise<ExtensionStatus> {
  await releaseControl('User released browser control', true);
  return status();
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

async function retryHostUpdate(): Promise<ExtensionStatus> {
  if (nativePort && hostReleaseStatus.state === 'failed' && hostReleaseStatus.retryAvailable) {
    sendNative({
      type: 'host.update.retry',
      protocol: PANERELAY_PROTOCOL_VERSION,
    });
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

async function setBrowserDefault(enabled: boolean): Promise<ExtensionStatus> {
  browserDefault = await requestIntegration({
    method: enabled ? 'browser-default.set-current' : 'browser-default.clear-current',
  });
  await broadcastStatus();
  return status();
}

async function setBrowserUseDefault(enabled: boolean): Promise<ExtensionStatus> {
  browserUseDefault = await requestIntegration({
    method: enabled ? 'browser-use-default.set' : 'browser-use-default.clear',
  });
  await broadcastStatus();
  return status();
}

async function installIntegration(integration: AutomationIntegrationId): Promise<ExtensionStatus> {
  try {
    await requestIntegration({ method: 'integration.install', integration });
  } finally {
    if (integration === 'agent-browser') await refreshDefaultProvider();
    else await refreshBrowserUseDefault();
  }
  return status();
}

function controlledTargetIdForTab(tabId: number): string {
  const targetId = targetIdsByTabId.get(tabId);
  if (!targetId || !controlledTabs.has(targetId)) {
    throw new Error('This tab is no longer controlled by Panerelay');
  }
  return targetId;
}

async function activateControlledTab(tabId: number): Promise<void> {
  controlledTargetIdForTab(tabId);
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  if (typeof tab.windowId === 'number') {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

async function closeControlledTab(tabId: number): Promise<void> {
  controlledTargetIdForTab(tabId);
  await chrome.tabs.remove(tabId);
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return false;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== 'string' || !type.startsWith('panerelay.')) return false;
  const runtimeMessage = message as Record<string, unknown>;
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
    type === 'panerelay.fetch-permission.decision' ||
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

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (typeof source.tabId !== 'number') return;
  const targetId = targetIdsByTabId.get(source.tabId);
  if (!targetId || !attachedTabs.has(targetId)) return;
  const port = nativePort;
  try {
    sendNative({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId,
      method,
      params: (params || {}) as Record<string, unknown>,
      ...(source.sessionId ? { sessionId: source.sessionId } : {}),
    });
  } catch (error) {
    handleDetachedNativeTaskError(port, error);
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (typeof source.tabId !== 'number') return;
  const targetId = targetIdsByTabId.get(source.tabId);
  if (!targetId || !attachedTabs.has(targetId)) return;
  attachedTabs.delete(targetId);
  const wasControlled = controlledTabs.delete(targetId);
  if (wasControlled) void restoreTargetFavicon(targetId, source.tabId);
  void updateActionBadge().catch(() => undefined);
  const detachReason = debuggerDetachReason(reason);
  if (!detachReason) {
    void broadcastStatus();
    return;
  }
  // Debugger displacement affects one target, not the Extension or Bridge as a whole.
  // The relay client still receives the explicit detach and can lazily reattach on its next command.
  try {
    sendNative({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      reason: detachReason,
      scope: 'target',
      targetId,
    });
  } catch {
    // A disconnected host already lost the lease.
  }
  void broadcastStatus();
});

async function publishTargetForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!targetDiscoveryActive) return;
  const summary = summarizeTab(tab);
  if (!summary || !targetExposure.has(summary.id)) return;
  const existingTargetId = targetIdsByTabId.get(summary.id);
  if (await isTabEligible(summary)) {
    if (!targetExposure.has(summary.id)) return;
    const target = await targetInfo(summary);
    const previous = publishedTargets.get(target.targetId);
    if (previous && targetInfoEquals(previous, target)) return;
    publishedTargets.set(target.targetId, target);
    sendNative({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: previous ? 'changed' : 'created',
      target,
    });
    return;
  }
  if (existingTargetId && publishedTargets.has(existingTargetId)) {
    sendNative({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: 'destroyed',
      targetId: existingTargetId,
    });
    publishedTargets.delete(existingTargetId);
    forgetTarget(existingTargetId);
  }
}

function queueTargetPublication(tabId: number): void {
  void targetPublicationQueue
    .enqueue(tabId, async () => {
      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch {
        return;
      }
      await publishTargetForTab(tab);
    })
    .catch(() => undefined);
}

function exposeRelatedTarget(sourceTabId: number, tabId: number): void {
  if (!targetDiscoveryActive) return;
  const sourceTargetId = targetIdsByTabId.get(sourceTabId);
  const sourceControlled = Boolean(sourceTargetId && controlledTabs.has(sourceTargetId));
  if (!targetExposure.exposeRelated(sourceTabId, tabId, sourceControlled)) return;
  queueTargetPublication(tabId);
}

chrome.tabs.onRemoved.addListener(tabId => {
  targetExposure.remove(tabId);
  const port = nativePort;
  void (async () => {
    await pageCommentService.resetIfDocumentEnded(tabId);
    const targetId = targetIdsByTabId.get(tabId);
    if (authorizedTab?.id === tabId) {
      authorizedTab = null;
      authorizedOriginPatterns = [];
      authorizationMode = 'none';
      await releaseControl('Authorized tab was closed', true);
    } else if (targetId && attachedTabs.has(targetId)) {
      await detachTarget(targetId, 'Attached tab was closed', false);
    }
    if (targetId && targetDiscoveryActive) {
      sendNative({
        type: 'cdp.target.event',
        protocol: PANERELAY_PROTOCOL_VERSION,
        event: 'destroyed',
        targetId,
      });
    }
    if (targetId) forgetTarget(targetId);
    await broadcastStatus();
  })().catch(error => handleDetachedNativeTaskError(port, error));
});
chrome.tabs.onCreated.addListener(tab => {
  if (typeof tab.id !== 'number') return;
  if (typeof tab.openerTabId === 'number') exposeRelatedTarget(tab.openerTabId, tab.id);
  queueTargetPublication(tab.id);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void pageCommentService.resetIfTabChanged(tabId);
  queueTargetPublication(tabId);
  void broadcastStatus();
  void broadcastWorkspaceForTab(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void (async () => {
    const authorizationModeAtUpdate = authorizationMode;
    if (changeInfo.status === 'loading' || changeInfo.url) {
      await pageCommentService.resetIfDocumentEnded(tabId);
    }
    const summary = summarizeTab(tab);
    if (authorizedTab?.id === tabId) {
      if (summary && (await isTabOriginAuthorized(summary))) {
        authorizedTab = summary;
      } else {
        authorizedTab = null;
        authorizedOriginPatterns = [];
        authorizationMode = 'none';
      }
    }
    const targetId = targetIdsByTabId.get(tabId);
    if (targetId && (changeInfo.status === 'loading' || changeInfo.url)) {
      controlledFaviconEngines.delete(targetId);
    }
    if (targetId && attachedTabs.has(targetId)) {
      if (!summary || !(await isTabEligible(summary))) {
        if (authorizationModeAtUpdate === 'single-tab') {
          authorizedTab = null;
          authorizedOriginPatterns = [];
          authorizationMode = 'none';
          await releaseControl('Tab navigated outside its authorized origin', true);
        } else {
          await detachTarget(targetId, 'Tab navigated outside its authorized origin', true);
          queueTargetPublication(tabId);
        }
        return;
      }
      attachedTabs.set(targetId, summary);
      if (controlledTabs.has(targetId)) controlledTabs.set(targetId, summary);
    }
    queueTargetPublication(tabId);
    if (changeInfo.url || changeInfo.title) await broadcastStatus();
  })();
});

chrome.webNavigation.onCreatedNavigationTarget.addListener(({ sourceTabId, tabId }) => {
  exposeRelatedTarget(sourceTabId, tabId);
});

chrome.permissions.onRemoved.addListener(() => {
  void (async () => {
    if (authorizationMode === 'all-tabs') {
      const granted = await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] });
      if (granted) return;
      authorizationMode = 'none';
      authorizedOriginPatterns = [];
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    } else if (authorizationMode === 'single-tab' && authorizedTab) {
      if (await isTabOriginAuthorized(authorizedTab)) return;
      authorizationMode = 'none';
      authorizedOriginPatterns = [];
      authorizedTab = null;
    } else {
      return;
    }
    await pageCommentService.reset();
    await releaseControl('Chrome site access was revoked', true);
  })();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && ACCENT_COLOR_KEY in changes) {
    void updateActionBadge().catch(() => undefined);
  }
});

installReleaseActionContextMenu({
  createMenu: (properties, callback) => {
    chrome.contextMenus.create(properties, callback);
  },
  getLastErrorMessage: () => chrome.runtime.lastError?.message,
  onClicked: listener => {
    chrome.contextMenus.onClicked.addListener(info => listener(info.menuItemId));
  },
  onInstalled: listener => {
    chrome.runtime.onInstalled.addListener(listener);
  },
  releaseControl: releaseBrowserControl,
  reportError: reportActionContextMenuError,
  title: chrome.i18n.getMessage('releaseAllControl'),
});

void updateActionBadge();
installConversationWorkspaceObservers(conversationWorkspaceStore, {
  onInherited: broadcastWorkspaceForTab,
});
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
void restorePersistentAuthorization()
  .catch(error => {
    lastError = error instanceof Error ? error.message : String(error);
  })
  .finally(connectNativeHost);
