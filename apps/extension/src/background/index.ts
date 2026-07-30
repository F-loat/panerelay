import {
  PANERELAY_NATIVE_HOST_NAME,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isHostToExtensionMessage,
  isNativeTransferEnvelope,
  type AgentProviderSummary,
  type AgentRequest,
  type AgentResponseMessage,
  type CdpCommandMessage,
  type CdpTargetInfo,
  type CdpTargetRequestMessage,
  type ConversationSummary,
  type HostToExtensionMessage,
  type IntegrationRequest,
  type IntegrationResponseMessage,
} from '@panerelay/protocol';
import { controlBadgeText } from './action-badge.js';
import { createControlActivityState, reduceControlActivity } from './control-activity-state.js';
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
} from '../shared/messages.js';
import {
  ALL_WEB_ORIGIN_PATTERNS,
  isOriginEligible,
  originAuthorizationForUrl,
} from '../shared/authorization.js';
import { applyControlledFavicon, releaseControlledFavicon } from './controlled-favicon.js';
import { debuggerDetachReason } from './debugger-detach.js';
import { installConversationWorkspaceObservers } from './conversation-workspace-observers.js';
import { ConversationWorkspaceService } from './conversation-workspace-service.js';
import { createChromeConversationWorkspaceStore } from './conversation-workspaces.js';
import type { ConversationWorkspaceSnapshot } from '../shared/conversation-workspaces.js';
import { nativeHostDisconnectState } from './native-host-readiness.js';

const BROWSER_ID_KEY = 'panerelay.browserId';
const ALL_TABS_AUTHORIZATION_KEY = 'panerelay.authorization.allTabs';
const RECONNECT_DELAY_MS = 2_000;
const AGENT_REQUEST_TIMEOUT_MS = 60_000;
const INTEGRATION_REQUEST_TIMEOUT_MS = 5_000;

interface PendingRequest<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type PendingAgentRequest = PendingRequest<unknown>;
type PendingIntegrationRequest = PendingRequest<DefaultProviderState>;

let nativePort: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let nativeHostState: NativeHostState = 'connecting';
let defaultProvider: DefaultProviderState | null = null;
let authorizationRequest: 'all-tabs' | null = null;
let authorizationMode: AuthorizationMode = 'none';
let authorizedOriginPatterns: string[] = [];
let authorizedTab: TabSummary | null = null;
let lastError: string | undefined;
let targetDiscoveryActive = false;
const targetIdsByTabId = new Map<number, string>();
const tabIdsByTargetId = new Map<string, number>();
const controlledTabs = new Map<string, TabSummary>();
const sessionOwnedTabIds = new Set<number>();
const pendingAgentRequests = new Map<string, PendingAgentRequest>();
const pendingIntegrationRequests = new Map<string, PendingIntegrationRequest>();
const nativeTransferReceiver = new NativeTransferReceiver();
let nativeTransferCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let controlActivityState = createControlActivityState();
const conversationWorkspaceStore = createChromeConversationWorkspaceStore();
const conversationWorkspaceService = new ConversationWorkspaceService({
  activeTabId: async () => (await activeTab())?.id ?? null,
  requestAgent,
  store: conversationWorkspaceStore,
});

async function updateActionBadge(): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: '#20e68f' });
  await chrome.action.setBadgeTextColor({ color: '#111513' });
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
    bridgeConnected: nativeHostState === 'connected',
    nativeHostState,
    defaultProvider,
    authorizationRequest,
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
  sendNative({
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: await browserId(),
    browserName: `Chrome on ${navigator.platform || 'this device'}`,
    extensionId: chrome.runtime.id,
    extensionVersion: chrome.runtime.getManifest().version,
  });
}

function rejectPendingAgentRequests(reason: string): void {
  for (const pending of pendingAgentRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
  }
  pendingAgentRequests.clear();
}

function rejectPendingIntegrationRequests(reason: string): void {
  for (const pending of pendingIntegrationRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
  }
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
          if (!isHostToExtensionMessage(message)) continue;
          void handleHostMessage(message);
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
      if (authorizationMode !== 'all-tabs') {
        authorizationMode = 'none';
        authorizedOriginPatterns = [];
      }
      authorizedTab = null;
      rejectPendingAgentRequests(lastError);
      rejectPendingIntegrationRequests(lastError);
      void releaseControl('Panerelay Bridge disconnected', false);
      void broadcastStatus();
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
  switch (message.type) {
    case 'browser.registered':
      nativeHostState = 'connected';
      lastError = undefined;
      await broadcastStatus();
      void refreshDefaultProvider();
      return;
    case 'cdp.target.request':
      await handleTargetRequest(message);
      return;
    case 'cdp.attach':
      await attachTarget(message.requestId, message.targetId);
      return;
    case 'cdp.command':
      await runCdpCommand(message);
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
      const eventMessage: ConversationChangedMessage = {
        type: 'panerelay.conversation.event',
        event: message.event,
      };
      await chrome.runtime.sendMessage(eventMessage).catch(() => undefined);
      return;
    }
  }
}

function handleAgentResponse(message: AgentResponseMessage): void {
  const pending = pendingAgentRequests.get(message.requestId);
  if (!pending) return;
  pendingAgentRequests.delete(message.requestId);
  clearTimeout(pending.timer);
  if (message.success) {
    pending.resolve(message.result);
  } else {
    pending.reject(new Error(message.error || 'Agent request failed'));
  }
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
  if (message.success && message.result) {
    pending.resolve(message.result);
  } else {
    pending.reject(new Error(message.error || 'Integration request failed'));
  }
}

function requestIntegration(request: IntegrationRequest): Promise<DefaultProviderState> {
  const requestId = crypto.randomUUID();
  const result = new Promise<DefaultProviderState>((resolve, reject) => {
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
  if (controlledTabs.delete(targetId)) void updateActionBadge();
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
    attached: controlledTabs.has(targetId),
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
  targetDiscoveryActive = true;
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

    if (!controlledTabs.has(targetId)) {
      await chrome.debugger.attach({ tabId: summary.id }, '1.3');
      controlledTabs.set(targetId, summary);
    }
    await applyControlledFavicon(summary.id);
    await updateActionBadge();
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
  const target = controlledTabs.get(message.targetId);
  if (!target) {
    sendNative({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      error: { code: -32000, message: 'No tab is currently controlled' },
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
      error: { code: -32000, message: 'The controlled tab origin is no longer authorized' },
    });
    if (authorizationMode === 'single-tab') {
      await releaseControl('Controlled tab origin is no longer authorized', true);
    } else {
      await detachTarget(message.targetId, 'Controlled tab origin is no longer authorized', true);
    }
    return;
  }

  try {
    const debuggee = {
      tabId: current.id,
      ...(message.sessionId ? { sessionId: message.sessionId } : {}),
    } as chrome.debugger.Debuggee;
    await applyControlledFavicon(current.id);
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

async function detachTarget(targetId: string, reason: string, notifyHost: boolean): Promise<void> {
  const tab = controlledTabs.get(targetId);
  controlledTabs.delete(targetId);
  if (tab) {
    await releaseControlledFavicon(tab.id);
    await chrome.debugger.detach({ tabId: tab.id }).catch(() => undefined);
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
  const targets = [...controlledTabs.keys()];
  for (const targetId of targets) await detachTarget(targetId, reason, false);
  targetDiscoveryActive = false;
  targetIdsByTabId.clear();
  tabIdsByTargetId.clear();
  sessionOwnedTabIds.clear();
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
  if (controlledTabs.size > 0 || targetDiscoveryActive) {
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

async function handleSidePanelRequest(message: SidePanelRequest): Promise<SidePanelResponse> {
  switch (message.type) {
    case 'panerelay.status.get':
      return { success: true, status: await status() };
    case 'panerelay.authorization.set':
      return { success: true, status: await setAuthorization(message.mode) };
    case 'panerelay.native.retry':
      return { success: true, status: await retryNativeHost() };
    case 'panerelay.default-provider.set':
      return { success: true, status: await setDefaultProvider(message.enabled) };
    case 'panerelay.controlled-tab.activate':
      await activateControlledTab(message.tabId);
      return { success: true };
    case 'panerelay.controlled-tab.close':
      await closeControlledTab(message.tabId);
      return { success: true };
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
    case 'panerelay.conversation.list':
      return {
        success: true,
        conversations: (await requestAgent({
          method: 'conversation.list',
          providerId: message.providerId,
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
    case 'panerelay.conversation.send': {
      return {
        success: true,
        ...(await conversationWorkspaceService.send(
          message.providerId,
          message.expectedRevision,
          message.text,
          message.conversationId,
        )),
      };
    }
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return false;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== 'string' || !type.startsWith('panerelay.')) return false;
  if (
    type === 'panerelay.status.changed' ||
    type === 'panerelay.conversation.event' ||
    type === 'panerelay.workspace.changed'
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
  if (!targetId || !controlledTabs.has(targetId)) return;
  sendNative({
    type: 'cdp.event',
    protocol: PANERELAY_PROTOCOL_VERSION,
    targetId,
    method,
    params: (params || {}) as Record<string, unknown>,
    ...(source.sessionId ? { sessionId: source.sessionId } : {}),
  });
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (typeof source.tabId !== 'number') return;
  const targetId = targetIdsByTabId.get(source.tabId);
  if (!targetId || !controlledTabs.has(targetId)) return;
  controlledTabs.delete(targetId);
  void releaseControlledFavicon(source.tabId);
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
  if (!summary) return;
  const existingTargetId = targetIdsByTabId.get(summary.id);
  if (await isTabEligible(summary)) {
    const target = await targetInfo(summary);
    sendNative({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: existingTargetId ? 'changed' : 'created',
      target,
    });
    return;
  }
  if (existingTargetId) {
    sendNative({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: 'destroyed',
      targetId: existingTargetId,
    });
    forgetTarget(existingTargetId);
  }
}

chrome.tabs.onRemoved.addListener(tabId => {
  void (async () => {
    const targetId = targetIdsByTabId.get(tabId);
    if (authorizedTab?.id === tabId) {
      authorizedTab = null;
      authorizedOriginPatterns = [];
      authorizationMode = 'none';
      await releaseControl('Authorized tab was closed', true);
    } else if (targetId && controlledTabs.has(targetId)) {
      await detachTarget(targetId, 'Controlled tab was closed', false);
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
  })();
});
chrome.tabs.onCreated.addListener(tab => void publishTargetForTab(tab));
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs
    .get(tabId)
    .then(publishTargetForTab)
    .catch(() => undefined);
  void broadcastStatus();
  void broadcastWorkspaceForTab(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void (async () => {
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
    if (targetId && controlledTabs.has(targetId)) {
      if (!summary || !(await isTabEligible(summary))) {
        if (authorizationMode === 'single-tab') {
          authorizedTab = null;
          authorizedOriginPatterns = [];
          authorizationMode = 'none';
          await releaseControl('Tab navigated outside its authorized origin', true);
        } else {
          await detachTarget(targetId, 'Tab navigated outside its authorized origin', true);
          await publishTargetForTab(tab);
        }
        return;
      }
      controlledTabs.set(targetId, summary);
    }
    await publishTargetForTab(tab);
    if (changeInfo.url || changeInfo.title) await broadcastStatus();
  })();
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
    await releaseControl('Chrome site access was revoked', true);
  })();
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
