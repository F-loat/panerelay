import {
  PANERELAY_PROTOCOL_VERSION,
  type CdpCommandMessage,
  type CdpTargetInfo,
  type CdpTargetRequestMessage,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import {
  ALL_WEB_ORIGIN_PATTERNS,
  isOriginEligible,
  originAuthorizationForUrl,
} from '../../shared/authorization.js';
import type { BrowserRuntime } from '../../shared/browser-runtime.js';
import type { AuthorizationMode, TabSummary } from '../../shared/messages.js';
import type {
  CollaborationAutomationAdapter,
  CollaborationAutomationContext,
  CollaborationAutomationSnapshot,
} from '../shared/collaboration-runtime.js';
import { controlBadgeText } from './action-badge.js';
import { cdpCommandTouchesDocument } from './cdp-document-activity.js';
import { applyControlledFavicon, releaseControlledFavicon } from './controlled-favicon.js';
import { debuggerDetachReason } from './debugger-detach.js';
import {
  TargetExposureState,
  TargetPublicationQueue,
  targetInfoEquals,
} from './target-publication.js';

const ALL_TABS_AUTHORIZATION_KEY = 'panerelay.authorization.allTabs';

export class ChromiumCdpAutomationAdapter implements CollaborationAutomationAdapter {
  private authorizationRequest: 'all-tabs' | null = null;
  private authorizationMode: AuthorizationMode = 'none';
  private authorizedOriginPatterns: string[] = [];
  private authorizedTab: TabSummary | null = null;
  private targetDiscoveryActive = false;
  private readonly targetIdsByTabId = new Map<number, string>();
  private readonly tabIdsByTargetId = new Map<string, number>();
  private readonly attachedTabs = new Map<string, TabSummary>();
  private readonly controlledTabs = new Map<string, TabSummary>();
  private readonly publishedTargets = new Map<string, CdpTargetInfo>();
  private readonly sessionOwnedTabIds = new Set<number>();
  private readonly targetExposure = new TargetExposureState();
  private readonly targetPublicationQueue = new TargetPublicationQueue();
  private debuggerListenersInstalled = false;

  constructor(private readonly browserRuntime: BrowserRuntime) {}

  async snapshot(): Promise<CollaborationAutomationSnapshot> {
    const active = await this.activeTabSummary();
    const controlled = [...this.controlledTabs.values()];
    return {
      authorizationRequest: this.authorizationRequest,
      authorizationMode: this.authorizationMode,
      authorizedOriginPatterns: [...this.authorizedOriginPatterns],
      authorizedTab: this.authorizedTab,
      automation: {
        transport: 'cdp',
        ready: this.browserRuntime.cdpRelay,
      },
      controlledTab: controlled.find(tab => tab.id === active?.id) ?? controlled[0] ?? null,
      controlledTabs: controlled,
    };
  }

  async start(context: CollaborationAutomationContext): Promise<void> {
    await this.restorePersistentAuthorization();
    await this.updateActionBadge();
    if (this.browserRuntime.chromiumSidePanel) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
    this.installDebuggerListeners(context);
  }

  async handleHostMessage(
    message: HostToExtensionMessage,
    context: CollaborationAutomationContext,
  ): Promise<boolean> {
    switch (message.type) {
      case 'cdp.target.request':
        await this.handleTargetRequest(message, context);
        return true;
      case 'cdp.attach':
        await this.attachTarget(message.requestId, message.targetId, context);
        return true;
      case 'cdp.command':
        await this.runCdpCommand(message, context);
        return true;
      case 'cdp.detach':
        if (message.targetId) {
          await this.detachTarget(message.targetId, message.reason, false, context);
        } else {
          await this.releaseControl(message.reason, false, context);
        }
        return true;
      default:
        return false;
    }
  }

  async setAuthorization(
    mode: AuthorizationMode,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (!this.browserRuntime.cdpRelay && mode !== 'none') {
      throw new Error('Existing-tab CDP automation is unavailable in this browser');
    }
    if (this.attachedTabs.size > 0 || this.targetDiscoveryActive) {
      await this.releaseControl('User changed browser authorization', true, context);
    }

    if (mode === 'single-tab') {
      const tab = await context.activeTab();
      if (!tab) throw new Error('No active browser tab is available');
      const origin = originAuthorizationForUrl(tab.url);
      if (!origin) throw new Error(`Panerelay cannot control ${tab.url || 'this page'}`);
      if (!(await chrome.permissions.contains({ origins: [origin.permissionPattern] }))) {
        throw new Error(`${this.browserRuntime.browserName} site access was not granted`);
      }
      this.authorizedTab = tab;
      this.authorizedOriginPatterns = [origin.permissionPattern];
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    } else if (mode === 'all-tabs') {
      if (!(await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] }))) {
        throw new Error(
          `${this.browserRuntime.browserName} access to all web origins was not granted`,
        );
      }
      this.authorizedTab = null;
      this.authorizedOriginPatterns = [...ALL_WEB_ORIGIN_PATTERNS];
      await chrome.storage.local.set({ [ALL_TABS_AUTHORIZATION_KEY]: true });
    } else {
      this.authorizedTab = null;
      this.authorizedOriginPatterns = [];
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    }
    this.authorizationMode = mode;
    this.authorizationRequest = null;
    await context.broadcastStatus();
  }

  async activateTarget(tabId: number, _context: CollaborationAutomationContext): Promise<void> {
    this.controlledTargetIdForTab(tabId);
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  }

  async closeTarget(tabId: number, _context: CollaborationAutomationContext): Promise<void> {
    this.controlledTargetIdForTab(tabId);
    await chrome.tabs.remove(tabId);
  }

  async onNativeDisconnected(context: CollaborationAutomationContext): Promise<void> {
    if (this.authorizationMode !== 'all-tabs') {
      this.authorizationMode = 'none';
      this.authorizedOriginPatterns = [];
    }
    this.authorizedTab = null;
    await this.releaseControl('Panerelay Bridge disconnected', false, context);
  }

  onTabCreated(tab: chrome.tabs.Tab, context: CollaborationAutomationContext): void {
    if (typeof tab.id !== 'number') return;
    if (typeof tab.openerTabId === 'number') {
      this.exposeRelatedTarget(tab.openerTabId, tab.id, context);
    }
    this.queueTargetPublication(tab.id, context);
  }

  onTabActivated(tabId: number, context: CollaborationAutomationContext): void {
    this.queueTargetPublication(tabId, context);
  }

  onTabRemoved(tabId: number, context: CollaborationAutomationContext): void {
    this.targetExposure.remove(tabId);
    void this.handleTabRemoved(tabId, context);
  }

  onTabUpdated(
    tabId: number,
    changeInfo: { status?: string; title?: string; url?: string },
    tab: chrome.tabs.Tab,
    context: CollaborationAutomationContext,
  ): void {
    void this.handleTabUpdated(tabId, changeInfo, tab, context);
  }

  onNavigationTargetCreated(
    sourceTabId: number,
    tabId: number,
    context: CollaborationAutomationContext,
  ): void {
    this.exposeRelatedTarget(sourceTabId, tabId, context);
  }

  onPermissionsRemoved(context: CollaborationAutomationContext): void {
    void this.handlePermissionsRemoved(context);
  }

  private async activeTabSummary(): Promise<TabSummary | null> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab ? this.summarizeTab(tab) : null;
  }

  private summarizeTab(tab: chrome.tabs.Tab): TabSummary | null {
    if (typeof tab.id !== 'number') return null;
    return {
      id: tab.id,
      title: tab.title || 'Untitled tab',
      url: tab.url || '',
    };
  }

  private async restorePersistentAuthorization(): Promise<void> {
    if (!this.browserRuntime.cdpRelay) {
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
      return;
    }
    const stored = await chrome.storage.local.get(ALL_TABS_AUTHORIZATION_KEY);
    if (stored[ALL_TABS_AUTHORIZATION_KEY] !== true) return;
    const granted = await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] });
    if (!granted) {
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
      return;
    }
    this.authorizationMode = 'all-tabs';
    this.authorizedOriginPatterns = [...ALL_WEB_ORIGIN_PATTERNS];
  }

  private async updateActionBadge(): Promise<void> {
    if (!this.browserRuntime.actionBadge) return;
    await chrome.action.setBadgeBackgroundColor({ color: '#20e68f' });
    await chrome.action.setBadgeTextColor?.({ color: '#111513' });
    await chrome.action.setBadgeText({ text: controlBadgeText(this.controlledTabs.size) });
  }

  private async isTabOriginAuthorized(tab: TabSummary): Promise<boolean> {
    const origin = originAuthorizationForUrl(tab.url);
    if (!origin) return false;
    if (!this.browserRuntime.cdpRelay) {
      return chrome.permissions.contains({ origins: [origin.permissionPattern] });
    }
    if (!isOriginEligible(tab.url, this.authorizationMode, this.authorizedOriginPatterns)) {
      return false;
    }
    return chrome.permissions.contains({
      origins:
        this.authorizationMode === 'all-tabs' && origin.origin !== 'file://'
          ? [...ALL_WEB_ORIGIN_PATTERNS]
          : [origin.permissionPattern],
    });
  }

  private targetIdForTabId(tabId: number): string {
    const existing = this.targetIdsByTabId.get(tabId);
    if (existing) return existing;
    const targetId = crypto.randomUUID();
    this.targetIdsByTabId.set(tabId, targetId);
    this.tabIdsByTargetId.set(targetId, tabId);
    return targetId;
  }

  private forgetTarget(targetId: string): void {
    const tabId = this.tabIdsByTargetId.get(targetId);
    if (tabId !== undefined) {
      this.targetIdsByTabId.delete(tabId);
      this.sessionOwnedTabIds.delete(tabId);
    }
    this.tabIdsByTargetId.delete(targetId);
    this.attachedTabs.delete(targetId);
    this.publishedTargets.delete(targetId);
    if (this.controlledTabs.delete(targetId)) void this.updateActionBadge();
  }

  private isSessionOwnedBlankTab(tab: TabSummary): boolean {
    return this.sessionOwnedTabIds.has(tab.id) && (tab.url === '' || tab.url === 'about:blank');
  }

  private async isTabEligible(tab: TabSummary): Promise<boolean> {
    if (this.authorizationMode === 'single-tab' && this.authorizedTab?.id !== tab.id) {
      return false;
    }
    if (this.authorizationMode === 'all-tabs' && this.isSessionOwnedBlankTab(tab)) return true;
    return this.isTabOriginAuthorized(tab);
  }

  private async targetInfo(tab: TabSummary, preferredActiveTabId?: number): Promise<CdpTargetInfo> {
    const targetId = this.targetIdForTabId(tab.id);
    const currentActiveTab =
      preferredActiveTabId === undefined ? await this.activeTabSummary() : null;
    return {
      targetId,
      type: 'page',
      title: tab.title,
      url: tab.url,
      attached: this.attachedTabs.has(targetId),
      active: preferredActiveTabId === tab.id || currentActiveTab?.id === tab.id,
    };
  }

  private async tabForTarget(targetId: string): Promise<TabSummary> {
    const tabId = this.tabIdsByTargetId.get(targetId);
    if (tabId === undefined) throw new Error('Panerelay target is no longer available');
    const tab = this.summarizeTab(await chrome.tabs.get(tabId));
    if (!tab) throw new Error('Panerelay target is no longer available');
    return tab;
  }

  private async listEligibleTargets(): Promise<CdpTargetInfo[]> {
    let tabs: Array<{ summary: TabSummary; active: boolean; lastAccessed: number }> = [];
    if (this.authorizationMode === 'single-tab' && this.authorizedTab) {
      const currentTab = await chrome.tabs.get(this.authorizedTab.id);
      const current = this.summarizeTab(currentTab);
      if (current && (await this.isTabEligible(current))) {
        tabs = [
          {
            summary: current,
            active: currentTab.active,
            lastAccessed: currentTab.lastAccessed || 0,
          },
        ];
      }
    } else if (this.authorizationMode === 'all-tabs') {
      for (const tab of await chrome.tabs.query({})) {
        const summary = this.summarizeTab(tab);
        if (summary && (await this.isTabEligible(summary))) {
          tabs.push({
            summary,
            active: tab.active,
            lastAccessed: tab.lastAccessed || 0,
          });
        }
      }
    }

    this.targetExposure.seedEligible(tabs.map(tab => tab.summary.id));
    tabs = tabs.filter(tab => this.targetExposure.has(tab.summary.id));
    this.targetDiscoveryActive = true;
    const currentActiveTab = await this.activeTabSummary();
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
    return Promise.all(tabs.map(tab => this.targetInfo(tab.summary, preferred?.summary.id)));
  }

  private sendTargetResult(
    requestId: string,
    result:
      | { success: true; targets?: CdpTargetInfo[]; target?: CdpTargetInfo }
      | { success: false; error: string },
    context: CollaborationAutomationContext,
  ): void {
    if (result.success) {
      for (const target of result.targets ?? (result.target ? [result.target] : [])) {
        this.publishedTargets.set(target.targetId, target);
      }
    }
    context.sendNative({
      type: 'cdp.target.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      ...result,
    });
  }

  private async handleTargetRequest(
    message: CdpTargetRequestMessage,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (!this.browserRuntime.cdpRelay) {
      this.sendTargetResult(
        message.requestId,
        { success: false, error: 'Existing-tab CDP automation is unavailable' },
        context,
      );
      return;
    }
    try {
      switch (message.operation.kind) {
        case 'list':
          this.sendTargetResult(
            message.requestId,
            { success: true, targets: await this.listEligibleTargets() },
            context,
          );
          return;
        case 'create': {
          if (this.authorizationMode !== 'all-tabs') {
            this.authorizationRequest = 'all-tabs';
            throw new Error(
              'Creating a new tab requires all-tabs authorization. Open Panerelay, authorize all tabs, then retry.',
            );
          }
          const url = message.operation.url || 'about:blank';
          if (url !== 'about:blank') {
            const origin = originAuthorizationForUrl(url);
            if (
              !origin ||
              !(await chrome.permissions.contains({ origins: [origin.permissionPattern] }))
            ) {
              throw new Error(
                `${this.browserRuntime.browserName} site access for ${origin?.origin || url} is not granted`,
              );
            }
          }
          const tab = await chrome.tabs.create({ url, active: false });
          const summary = this.summarizeTab(tab);
          if (!summary) throw new Error('The browser did not create a controllable tab');
          this.sessionOwnedTabIds.add(summary.id);
          this.targetExposure.expose(summary.id);
          this.sendTargetResult(
            message.requestId,
            { success: true, target: await this.targetInfo(summary) },
            context,
          );
          return;
        }
        case 'close':
          await chrome.tabs.remove((await this.tabForTarget(message.operation.targetId)).id);
          this.sendTargetResult(message.requestId, { success: true }, context);
          return;
        case 'activate':
          this.sendTargetResult(
            message.requestId,
            {
              success: true,
              target: await this.targetInfo(await this.tabForTarget(message.operation.targetId)),
            },
            context,
          );
          return;
      }
    } catch (error) {
      this.sendTargetResult(
        message.requestId,
        { success: false, error: error instanceof Error ? error.message : String(error) },
        context,
      );
      await context.broadcastStatus();
    }
  }

  private async attachTarget(
    requestId: string,
    targetId: string,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (!this.browserRuntime.cdpRelay) {
      context.sendNative({
        type: 'cdp.attached',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        success: false,
        error: 'Existing-tab CDP automation is unavailable',
      });
      return;
    }
    try {
      const summary = await this.tabForTarget(targetId);
      if (!(await this.isTabEligible(summary))) {
        throw new Error(
          `${this.browserRuntime.browserName} site access for ${summary.url || 'this page'} is not granted`,
        );
      }
      if (!this.attachedTabs.has(targetId)) {
        await chrome.debugger.attach({ tabId: summary.id }, '1.3');
        this.attachedTabs.set(targetId, summary);
      }
      context.sendNative({
        type: 'cdp.attached',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        success: true,
        target: await this.targetInfo(summary),
      });
    } catch (error) {
      context.sendNative({
        type: 'cdp.attached',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await context.broadcastStatus();
  }

  private async runCdpCommand(
    message: CdpCommandMessage,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    const target = this.attachedTabs.get(message.targetId);
    if (!this.browserRuntime.cdpRelay || !target) {
      context.sendNative({
        type: 'cdp.result',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        error: {
          code: -32000,
          message: this.browserRuntime.cdpRelay
            ? 'No tab is currently attached'
            : 'Existing-tab CDP automation is unavailable',
        },
      });
      return;
    }
    let current: TabSummary | null;
    try {
      current = this.summarizeTab(await chrome.tabs.get(target.id));
    } catch {
      current = null;
    }
    if (!current || !(await this.isTabEligible(current))) {
      context.sendNative({
        type: 'cdp.result',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        error: { code: -32000, message: 'The attached tab origin is no longer authorized' },
      });
      if (this.authorizationMode === 'single-tab') {
        await this.releaseControl('Attached tab origin is no longer authorized', true, context);
      } else {
        await this.detachTarget(
          message.targetId,
          'Attached tab origin is no longer authorized',
          true,
          context,
        );
      }
      return;
    }

    try {
      const debuggee = {
        tabId: current.id,
        ...(message.sessionId ? { sessionId: message.sessionId } : {}),
      } as chrome.debugger.Debuggee;
      if (cdpCommandTouchesDocument(message.method)) {
        if (!this.controlledTabs.has(message.targetId)) {
          this.controlledTabs.set(message.targetId, current);
          await this.updateActionBadge();
          await context.broadcastStatus();
        }
        await applyControlledFavicon(current.id);
      }
      const result = await chrome.debugger.sendCommand(
        debuggee,
        message.method as never,
        message.params as never,
      );
      context.sendNative({
        type: 'cdp.result',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        result: result ?? {},
      });
    } catch (error) {
      context.sendNative({
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

  private async detachTarget(
    targetId: string,
    reason: string,
    notifyHost: boolean,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    const tab = this.attachedTabs.get(targetId);
    this.attachedTabs.delete(targetId);
    this.controlledTabs.delete(targetId);
    if (tab) {
      await releaseControlledFavicon(tab.id);
      await chrome.debugger.detach({ tabId: tab.id }).catch(() => undefined);
    }
    await this.updateActionBadge().catch(() => undefined);
    if (notifyHost) {
      try {
        context.sendNative({
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
    await context.broadcastStatus();
  }

  private async releaseControl(
    reason: string,
    notifyHost: boolean,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    for (const targetId of [...this.attachedTabs.keys()]) {
      await this.detachTarget(targetId, reason, false, context);
    }
    this.targetDiscoveryActive = false;
    this.targetIdsByTabId.clear();
    this.tabIdsByTargetId.clear();
    this.publishedTargets.clear();
    this.sessionOwnedTabIds.clear();
    this.targetExposure.clear();
    if (notifyHost) {
      try {
        context.sendNative({
          type: 'cdp.detached',
          protocol: PANERELAY_PROTOCOL_VERSION,
          reason,
          scope: 'lease',
        });
      } catch {
        // A disconnected host already lost the lease.
      }
    }
    await context.broadcastStatus();
  }

  private controlledTargetIdForTab(tabId: number): string {
    const targetId = this.targetIdsByTabId.get(tabId);
    if (!targetId || !this.controlledTabs.has(targetId)) {
      throw new Error('This tab is no longer controlled by Panerelay');
    }
    return targetId;
  }

  private installDebuggerListeners(context: CollaborationAutomationContext): void {
    if (!this.browserRuntime.cdpRelay || this.debuggerListenersInstalled) return;
    this.debuggerListenersInstalled = true;
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (typeof source.tabId !== 'number') return;
      const targetId = this.targetIdsByTabId.get(source.tabId);
      if (!targetId || !this.attachedTabs.has(targetId)) return;
      try {
        context.sendNative({
          type: 'cdp.event',
          protocol: PANERELAY_PROTOCOL_VERSION,
          targetId,
          method,
          params: (params || {}) as Record<string, unknown>,
          ...(source.sessionId ? { sessionId: source.sessionId } : {}),
        });
      } catch {
        // Native disconnect cleanup owns the remaining target state.
      }
    });
    chrome.debugger.onDetach.addListener((source, reason) => {
      if (typeof source.tabId !== 'number') return;
      const targetId = this.targetIdsByTabId.get(source.tabId);
      if (!targetId || !this.attachedTabs.has(targetId)) return;
      this.attachedTabs.delete(targetId);
      const wasControlled = this.controlledTabs.delete(targetId);
      if (wasControlled) void releaseControlledFavicon(source.tabId);
      void this.updateActionBadge().catch(() => undefined);
      const detachReason = debuggerDetachReason(reason);
      if (detachReason) {
        try {
          context.sendNative({
            type: 'cdp.detached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            reason: detachReason,
            scope: 'target',
            targetId,
          });
        } catch {
          // A disconnected host already lost the lease.
        }
      }
      void context.broadcastStatus();
    });
  }

  private async publishTargetForTab(
    tab: chrome.tabs.Tab,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (!this.targetDiscoveryActive) return;
    const summary = this.summarizeTab(tab);
    if (!summary || !this.targetExposure.has(summary.id)) return;
    const existingTargetId = this.targetIdsByTabId.get(summary.id);
    if (await this.isTabEligible(summary)) {
      const target = await this.targetInfo(summary);
      const previous = this.publishedTargets.get(target.targetId);
      if (previous && targetInfoEquals(previous, target)) return;
      this.publishedTargets.set(target.targetId, target);
      context.sendNative({
        type: 'cdp.target.event',
        protocol: PANERELAY_PROTOCOL_VERSION,
        event: previous ? 'changed' : 'created',
        target,
      });
      return;
    }
    if (existingTargetId && this.publishedTargets.has(existingTargetId)) {
      context.sendNative({
        type: 'cdp.target.event',
        protocol: PANERELAY_PROTOCOL_VERSION,
        event: 'destroyed',
        targetId: existingTargetId,
      });
      this.publishedTargets.delete(existingTargetId);
      this.forgetTarget(existingTargetId);
    }
  }

  private queueTargetPublication(tabId: number, context: CollaborationAutomationContext): void {
    void this.targetPublicationQueue
      .enqueue(tabId, async () => {
        let tab: chrome.tabs.Tab;
        try {
          tab = await chrome.tabs.get(tabId);
        } catch {
          return;
        }
        await this.publishTargetForTab(tab, context);
      })
      .catch(() => undefined);
  }

  private exposeRelatedTarget(
    sourceTabId: number,
    tabId: number,
    context: CollaborationAutomationContext,
  ): void {
    if (!this.targetDiscoveryActive) return;
    const sourceTargetId = this.targetIdsByTabId.get(sourceTabId);
    const sourceControlled = Boolean(sourceTargetId && this.controlledTabs.has(sourceTargetId));
    if (!this.targetExposure.exposeRelated(sourceTabId, tabId, sourceControlled)) return;
    this.queueTargetPublication(tabId, context);
  }

  private async handleTabRemoved(
    tabId: number,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    const targetId = this.targetIdsByTabId.get(tabId);
    if (this.authorizedTab?.id === tabId) {
      this.authorizedTab = null;
      this.authorizedOriginPatterns = [];
      this.authorizationMode = 'none';
      await this.releaseControl('Authorized tab was closed', true, context);
    } else if (targetId && this.attachedTabs.has(targetId)) {
      await this.detachTarget(targetId, 'Attached tab was closed', false, context);
    }
    if (targetId && this.targetDiscoveryActive) {
      context.sendNative({
        type: 'cdp.target.event',
        protocol: PANERELAY_PROTOCOL_VERSION,
        event: 'destroyed',
        targetId,
      });
    }
    if (targetId) this.forgetTarget(targetId);
    await context.broadcastStatus();
  }

  private async handleTabUpdated(
    tabId: number,
    changeInfo: { status?: string; title?: string; url?: string },
    tab: chrome.tabs.Tab,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    const summary = this.summarizeTab(tab);
    if (this.authorizedTab?.id === tabId) {
      if (summary && (await this.isTabOriginAuthorized(summary))) {
        this.authorizedTab = summary;
      } else {
        this.authorizedTab = null;
        this.authorizedOriginPatterns = [];
        this.authorizationMode = 'none';
      }
    }
    const targetId = this.targetIdsByTabId.get(tabId);
    if (targetId && this.attachedTabs.has(targetId)) {
      if (!summary || !(await this.isTabEligible(summary))) {
        if (this.authorizationMode === 'single-tab') {
          this.authorizedTab = null;
          this.authorizedOriginPatterns = [];
          this.authorizationMode = 'none';
          await this.releaseControl('Tab navigated outside its authorized origin', true, context);
        } else {
          await this.detachTarget(
            targetId,
            'Tab navigated outside its authorized origin',
            true,
            context,
          );
          this.queueTargetPublication(tabId, context);
        }
        return;
      }
      this.attachedTabs.set(targetId, summary);
      if (this.controlledTabs.has(targetId)) this.controlledTabs.set(targetId, summary);
    }
    this.queueTargetPublication(tabId, context);
    if (changeInfo.url || changeInfo.title) await context.broadcastStatus();
  }

  private async handlePermissionsRemoved(context: CollaborationAutomationContext): Promise<void> {
    if (this.authorizationMode === 'all-tabs') {
      const granted = await chrome.permissions.contains({
        origins: [...ALL_WEB_ORIGIN_PATTERNS],
      });
      if (granted) return;
      this.authorizationMode = 'none';
      this.authorizedOriginPatterns = [];
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    } else if (this.authorizationMode === 'single-tab' && this.authorizedTab) {
      if (await this.isTabOriginAuthorized(this.authorizedTab)) return;
      this.authorizationMode = 'none';
      this.authorizedOriginPatterns = [];
      this.authorizedTab = null;
    } else {
      return;
    }
    await this.releaseControl(
      `${this.browserRuntime.browserName} site access was revoked`,
      true,
      context,
    );
  }
}
