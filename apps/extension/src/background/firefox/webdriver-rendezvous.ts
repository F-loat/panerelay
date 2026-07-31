import {
  PANERELAY_PROTOCOL_VERSION,
  type HostToExtensionMessage,
  type WebDriverReadinessMessage,
} from '@panerelay/protocol';
import {
  ALL_WEB_ORIGIN_PATTERNS,
  isOriginEligible,
  originAuthorizationForUrl,
} from '../../shared/authorization.js';
import type { AuthorizationMode, TabSummary } from '../../shared/messages.js';
import type {
  CollaborationAutomationAdapter,
  CollaborationAutomationContext,
  CollaborationAutomationSnapshot,
} from '../shared/collaboration-runtime.js';

const ALL_TABS_AUTHORIZATION_KEY = 'panerelay.firefox.authorization.allTabs';
const RENDEZVOUS_SOURCE = 'panerelay-webdriver-rendezvous';

interface AuthorizedTarget {
  documentId?: string;
  tab: TabSummary;
  targetId: string;
}

export function installFirefoxWebDriverRendezvousRuntime(): boolean {
  const marker = '__panerelayFirefoxWebDriverRendezvous';
  const global = globalThis as typeof globalThis & Record<string, unknown>;
  if (global[marker]) return true;
  global[marker] = true;
  const documentId = crypto.randomUUID();
  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;
    const candidate = event.data as Record<string, unknown>;
    if (
      candidate.source !== 'panerelay-webdriver-rendezvous' ||
      typeof candidate.requestId !== 'string' ||
      candidate.requestId.length < 1 ||
      candidate.requestId.length > 128 ||
      typeof candidate.challenge !== 'string' ||
      candidate.challenge.length < 16 ||
      candidate.challenge.length > 128
    ) {
      return;
    }
    void chrome.runtime.sendMessage({
      type: 'panerelay.webdriver.rendezvous',
      requestId: candidate.requestId,
      challenge: candidate.challenge,
      documentId,
    });
  });
  return true;
}

export class FirefoxWebDriverAutomationAdapter implements CollaborationAutomationAdapter {
  private authorizationMode: AuthorizationMode = 'none';
  private authorizedOriginPatterns: string[] = [];
  private authorizedTab: TabSummary | null = null;
  private readiness: WebDriverReadinessMessage = {
    type: 'webdriver.readiness',
    protocol: PANERELAY_PROTOCOL_VERSION,
    ready: false,
    reason: 'managed-restart-required',
    message: 'Close Firefox and reopen it with the Panerelay Firefox launcher',
  };
  private readonly targetsByTabId = new Map<number, AuthorizedTarget>();

  async snapshot(): Promise<CollaborationAutomationSnapshot> {
    return {
      authorizationRequest: null,
      authorizationMode: this.authorizationMode,
      authorizedOriginPatterns: [...this.authorizedOriginPatterns],
      authorizedTab: this.authorizedTab,
      automation: { transport: 'webdriver', ready: this.readiness.ready },
      automationMessage: this.readiness.message,
      controlledTab: null,
      controlledTabs: [],
    };
  }

  async start(context: CollaborationAutomationContext): Promise<void> {
    await this.restoreAllTabsAuthorization();
    await context.broadcastStatus();
  }

  async handleHostMessage(
    message: HostToExtensionMessage,
    context: CollaborationAutomationContext,
  ): Promise<boolean> {
    if (message.type === 'browser.registered') {
      this.sendAuthorization(context);
      return false;
    }
    if (message.type !== 'webdriver.readiness') return false;
    const changed =
      this.readiness.ready !== message.ready ||
      this.readiness.reason !== message.reason ||
      this.readiness.message !== message.message;
    this.readiness = message;
    if (!message.ready && this.authorizationMode !== 'none') {
      await this.releaseAuthorization(context, 'authorization-revoked');
    }
    if (changed) await context.registerBrowser();
    await context.broadcastStatus();
    return true;
  }

  async setAuthorization(
    mode: AuthorizationMode,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (mode !== 'none' && !this.readiness.ready) {
      throw new Error(this.readiness.message);
    }
    await this.releaseAuthorization(context, 'authorization-revoked', false);

    if (mode === 'single-tab') {
      const tab = await context.activeTab();
      if (!tab) throw new Error('Firefox has no active tab to authorize');
      const origin = originAuthorizationForUrl(tab.url);
      if (!origin) throw new Error('This Firefox page cannot be authorized for automation');
      const granted = await chrome.permissions.request({ origins: [origin.permissionPattern] });
      if (!granted) throw new Error(`Firefox site access for ${origin.origin} was not granted`);
      this.authorizationMode = 'single-tab';
      this.authorizedOriginPatterns = [origin.permissionPattern];
      this.authorizedTab = tab;
      await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
      await this.ensureRuntime(tab.id);
    } else if (mode === 'all-tabs') {
      const granted = await chrome.permissions.request({
        origins: [...ALL_WEB_ORIGIN_PATTERNS],
      });
      if (!granted) throw new Error('Firefox all-tabs site access was not granted');
      this.authorizationMode = 'all-tabs';
      this.authorizedOriginPatterns = [...ALL_WEB_ORIGIN_PATTERNS];
      this.authorizedTab = null;
      await chrome.storage.local.set({ [ALL_TABS_AUTHORIZATION_KEY]: true });
      await this.ensureEligibleRuntimes(context);
    }
    this.sendAuthorization(context);
    await context.broadcastStatus();
  }

  handleRuntimeMessage(
    message: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
    context: CollaborationAutomationContext,
  ): boolean {
    if (message.type !== 'panerelay.webdriver.rendezvous') return false;
    void this.handleRendezvous(message, sender, context);
    return true;
  }

  onTabRemoved(tabId: number, context: CollaborationAutomationContext): void {
    const target = this.targetsByTabId.get(tabId);
    if (target) this.invalidateTarget(target, 'closed', context);
    if (this.authorizationMode === 'single-tab' && this.authorizedTab?.id === tabId) {
      void this.releaseAuthorization(context, 'authorization-revoked').then(() =>
        context.broadcastStatus(),
      );
    }
  }

  onTabUpdated(
    tabId: number,
    changeInfo: { status?: string; title?: string; url?: string },
    tab: chrome.tabs.Tab,
    context: CollaborationAutomationContext,
  ): void {
    if (changeInfo.url || changeInfo.status === 'loading') {
      const target = this.targetsByTabId.get(tabId);
      if (target) this.invalidateTarget(target, 'navigation', context);
    }
    if (this.authorizationMode === 'single-tab' && this.authorizedTab?.id === tabId) {
      const summary = context.summarizeTab(tab);
      if (!summary || !isOriginEligible(summary.url, 'single-tab', this.authorizedOriginPatterns)) {
        void this.releaseAuthorization(context, 'authorization-revoked').then(() =>
          context.broadcastStatus(),
        );
        return;
      }
      this.authorizedTab = summary;
    }
    if (changeInfo.status === 'complete') {
      const summary = context.summarizeTab(tab);
      if (summary && this.isEligible(summary)) void this.ensureRuntime(tabId);
    }
  }

  onPermissionsRemoved(context: CollaborationAutomationContext): void {
    void this.reconcilePermissions(context);
  }

  async activateTarget(tabId: number): Promise<void> {
    if (![...this.targetsByTabId.keys()].includes(tabId)) {
      throw new Error('Firefox target is no longer authorized');
    }
    await chrome.tabs.update(tabId, { active: true });
  }

  async closeTarget(tabId: number): Promise<void> {
    if (![...this.targetsByTabId.keys()].includes(tabId)) {
      throw new Error('Firefox target is no longer authorized');
    }
    await chrome.tabs.remove(tabId);
  }

  private async handleRendezvous(
    message: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
    context: CollaborationAutomationContext,
  ): Promise<void> {
    if (
      sender.frameId !== 0 ||
      typeof sender.tab?.id !== 'number' ||
      typeof message.requestId !== 'string' ||
      typeof message.challenge !== 'string' ||
      typeof message.documentId !== 'string'
    ) {
      return;
    }
    const summary = context.summarizeTab(sender.tab);
    if (!summary || !this.isEligible(summary) || !(await this.hasSitePermission(summary))) return;
    const tabId = sender.tab.id;
    let target = this.targetsByTabId.get(tabId);
    if (!target) {
      target = { tab: summary, targetId: crypto.randomUUID() };
      this.targetsByTabId.set(tabId, target);
    }
    if (target.documentId && target.documentId !== message.documentId) {
      this.invalidateTarget(target, 'navigation', context, false);
    }
    target.tab = summary;
    target.documentId = message.documentId;
    context.sendNative({
      type: 'webdriver.rendezvous.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: message.requestId,
      challenge: message.challenge,
      success: true,
      targetId: target.targetId,
      documentId: target.documentId,
      active: sender.tab.active === true,
    });
  }

  private isEligible(tab: TabSummary): boolean {
    if (this.authorizationMode === 'single-tab' && this.authorizedTab?.id !== tab.id) return false;
    return isOriginEligible(tab.url, this.authorizationMode, this.authorizedOriginPatterns);
  }

  private async hasSitePermission(tab: TabSummary): Promise<boolean> {
    const origin = originAuthorizationForUrl(tab.url);
    if (!origin) return false;
    return chrome.permissions.contains({
      origins:
        this.authorizationMode === 'all-tabs' && origin.origin !== 'file://'
          ? [...ALL_WEB_ORIGIN_PATTERNS]
          : [origin.permissionPattern],
    });
  }

  private async ensureRuntime(tabId: number): Promise<boolean> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: installFirefoxWebDriverRendezvousRuntime,
      });
      return results.length === 1 && results[0]?.result === true;
    } catch {
      return false;
    }
  }

  private async ensureEligibleRuntimes(context: CollaborationAutomationContext): Promise<void> {
    for (const tab of await chrome.tabs.query({})) {
      const summary = context.summarizeTab(tab);
      if (summary && this.isEligible(summary)) await this.ensureRuntime(summary.id);
    }
  }

  private invalidateTarget(
    target: AuthorizedTarget,
    reason: 'navigation' | 'closed' | 'permission-revoked' | 'authorization-revoked',
    context: CollaborationAutomationContext,
    remove = true,
  ): void {
    if (remove) this.targetsByTabId.delete(target.tab.id);
    else target.documentId = undefined;
    try {
      context.sendNative({
        type: 'webdriver.target.invalidated',
        protocol: PANERELAY_PROTOCOL_VERSION,
        targetId: target.targetId,
        ...(target.documentId ? { documentId: target.documentId } : {}),
        reason,
      });
    } catch {
      // Native Messaging disconnect already invalidates Bridge mappings.
    }
  }

  private async releaseAuthorization(
    context: CollaborationAutomationContext,
    reason: 'permission-revoked' | 'authorization-revoked',
    notify = true,
  ): Promise<void> {
    for (const target of [...this.targetsByTabId.values()]) {
      this.invalidateTarget(target, reason, context);
    }
    this.authorizationMode = 'none';
    this.authorizedOriginPatterns = [];
    this.authorizedTab = null;
    await chrome.storage.local.remove(ALL_TABS_AUTHORIZATION_KEY);
    if (notify) this.sendAuthorization(context);
  }

  private sendAuthorization(context: CollaborationAutomationContext): void {
    try {
      context.sendNative({
        type: 'webdriver.authorization.changed',
        protocol: PANERELAY_PROTOCOL_VERSION,
        mode: this.authorizationMode,
      });
    } catch {
      // The next successful browser registration republishes authorization.
    }
  }

  private async restoreAllTabsAuthorization(): Promise<void> {
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

  private async reconcilePermissions(context: CollaborationAutomationContext): Promise<void> {
    if (this.authorizationMode === 'all-tabs') {
      const granted = await chrome.permissions.contains({ origins: [...ALL_WEB_ORIGIN_PATTERNS] });
      if (granted) return;
    } else if (this.authorizationMode === 'single-tab' && this.authorizedTab) {
      if (await this.hasSitePermission(this.authorizedTab)) return;
    } else {
      return;
    }
    await this.releaseAuthorization(context, 'permission-revoked');
    await context.broadcastStatus();
  }
}

export const FIREFOX_WEBDRIVER_RENDEZVOUS_SOURCE = RENDEZVOUS_SOURCE;
